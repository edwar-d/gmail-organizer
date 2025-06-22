from flask import Flask, request, redirect, session, url_for, render_template, jsonify
from flask_cors import CORS
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import os
import threading
import time
import uuid
from flask import jsonify
import pickle
import json
from datetime import timedelta
import base64
from utils import EmailClient, gen_categories, QuerySaver, CategoryStorage
import random
import asyncio
from concurrent.futures import ThreadPoolExecutor
import ssl
from googleapiclient.errors import HttpError
import httplib2

# Configure httplib2 for better SSL handling
httplib2.Http.force_exception_to_status_code = True

# Create a thread pool executor
executor = ThreadPoolExecutor(max_workers=4)

app = Flask(__name__)
CORS(app, origins=["http://localhost:5000"], supports_credentials=True)  # Enable CORS for static frontend
app.secret_key = 'your-secret-key'  # Use consistent secret key
app.permanent_session_lifetime = timedelta(minutes=15)

# Configure session cookie settings for cross-origin requests
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',  # Changed from 'None' to 'Lax' for better compatibility
    SESSION_COOKIE_SECURE=False,  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY=False,  # Allow JavaScript access for debugging
    SESSION_COOKIE_DOMAIN=None,  # Allow cookies across localhost ports
    SESSION_COOKIE_PATH='/'
)

# Add custom JSON filter for templates
@app.template_filter('tojson')
def to_json(value):
    return json.dumps(value)

# OAuth 2.0 configuration - using your exact redirect URIs
CLIENT_SECRETS_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify']
REDIRECT_URI = 'http://localhost:5000/login/google/authorized'  # Matches your credentials.json

# Initialize email client
email_client = EmailClient()
query = QuerySaver()

# Retry decorator for handling transient network/SSL errors
def retry_on_ssl_error(max_retries=3, base_delay=1.0, max_delay=10.0):
    """
    Decorator to retry function calls on SSL and network errors.
    Uses exponential backoff with jitter to avoid thundering herd.
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (ssl.SSLError, ConnectionError, TimeoutError, HttpError) as e:
                    last_exception = e
                    
                    # Log the error
                    print(f"[RETRY] Attempt {attempt + 1}/{max_retries + 1} failed for {func.__name__}: {str(e)}")
                    
                    # Don't retry on the last attempt
                    if attempt == max_retries:
                        break
                    
                    # Calculate delay with exponential backoff and jitter
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    jitter = random.uniform(0.1, 0.3) * delay  # Add 10-30% jitter
                    total_delay = delay + jitter
                    
                    print(f"[RETRY] Retrying in {total_delay:.2f} seconds...")
                    time.sleep(total_delay)
                
                except Exception as e:
                    # For non-network errors, don't retry
                    print(f"[ERROR] Non-retryable error in {func.__name__}: {str(e)}")
                    raise e
            
            # If we get here, all retries failed
            print(f"[ERROR] All {max_retries + 1} attempts failed for {func.__name__}")
            raise last_exception
        
        return wrapper
    return decorator

# Initialize the OAuth flow
def get_flow():
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

# Note: We can't use custom HTTP clients with credentials in Google API client
# The credentials object already contains the HTTP transport configuration

@app.route('/')
def index():
    """Main entry point - serve static frontend"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    
    return redirect(url_for('loading_page'))

@app.route('/inbox')
def inbox():
    """Main inbox route after loading"""
    if 'credentials' not in session:
        return redirect(url_for('index'))
    
    try:
        if email_client.has_service and email_client.email_list!=None:
            email_list = email_client.email_list
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')
        
        return render_template('inbox.html', 
                             emails=email_list, 
                             user_email=user_email,
                             total_emails=len(email_list))

    except Exception as e:
        return f"Error: {str(e)} <a href='/logout'>Try again</a>"

# Global dictionary to store categorization results (kept for API compatibility)
categorization_results = {}
categorization_status = {}

@app.route('/categorize')
def categorize():
    """Categorize emails and display results immediately"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    
    # Get the user query from URL parameters
    user_query = request.args.get('query', '')
    force_new = request.args.get('force_new', 'false').lower() == 'true'
    
    try:
        if email_client.has_service and email_client.email_list != None:
            email_list = email_client.email_list
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')

        # Validate email_list
        if not email_list or len(email_list) == 0:
            return "No emails found to categorize. <a href='/inbox'>Go back</a>"

        # Initialize category storage
        category_storage = CategoryStorage(user_email)
        
        # Check if we have saved categories and user isn't forcing a new categorization
        # AND no new query is provided (if there's a new query, always generate new categories)
        if not force_new and not user_query and category_storage.has_saved_categories():
            saved_data = category_storage.load_categories()
            if saved_data:
                return render_template('categorize.html', 
                                     categories=saved_data['categories'],
                                     user_email=saved_data['user_email'],
                                     total_emails=saved_data['email_count'],
                                     query=saved_data.get('query', ''),
                                     saved_at=saved_data.get('saved_at', ''),
                                     is_saved=True)

        # Show loading page with immediate categorization
        if request.args.get('loading') == 'true':
            # This is the actual categorization request
            print(f"[DEBUG] Starting categorization for {user_email}")
            print(f"[DEBUG] Email count: {len(email_list)}")
            print(f"[DEBUG] User query: '{user_query}'")
            
            # Call the categorization function directly
            print(f"[DEBUG] Calling gen_categories...")
            categories = gen_categories(email_list, user_query)
            print(f"[DEBUG] gen_categories returned: {categories}")
            
            # Group emails by category
            print(f"[DEBUG] Grouping emails by category...")
            categorized_emails = {}
            
            for i, email in enumerate(email_list):
                if i < len(categories):
                    category = categories[i]
                else:
                    category = 'Others'
                
                if category not in categorized_emails:
                    categorized_emails[category] = []
                
                categorized_emails[category].append(email)
            
            print(f"[DEBUG] Categorized emails: {list(categorized_emails.keys())}")
            print(f"[DEBUG] Category counts: {[(k, len(v)) for k, v in categorized_emails.items()]}")
            
            # Render the categorize template with results
            return render_template('categorize.html', 
                                 categories=categorized_emails,
                                 user_email=user_email,
                                 total_emails=len(email_list),
                                 query=user_query,
                                 is_saved=False)
        else:
            # First request - show loading page
            return render_template('categorize_loading.html',
                                 user_email=user_email,
                                 total_emails=len(email_list),
                                 query=user_query)

    except Exception as e:
        return f"Error during categorization: {str(e)} <a href='/inbox'>Go back</a>"

@app.route('/api/categorize')
def api_categorize():
    """API endpoint to get categorized emails as JSON"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_query = request.args.get('query', '')
    
    try:
        if email_client.has_service and email_client.email_list != None:
            email_list = email_client.email_list
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown')

        if not email_list:
            return jsonify({'error': 'No emails found'}), 404

        # Call the categorization function
        categories = gen_categories(email_list, user_query)
        
        # Group emails by category
        categorized_emails = {}
        for i, email in enumerate(email_list):
            category = categories[i] if i < len(categories) else 'Others'
            if category not in categorized_emails:
                categorized_emails[category] = []
            categorized_emails[category].append(email)
        
        return jsonify({
            'success': True,
            'categories': categorized_emails,
            'user_email': user_email,
            'total_emails': len(email_list),
            'query': user_query
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def categorize_emails_background(email_list, user_query, session_id, user_email, category_storage):
    """Background function to categorize emails"""
    try:
        print(f"[DEBUG] Starting categorization for session {session_id}")
        print(f"[DEBUG] Email count: {len(email_list)}")
        print(f"[DEBUG] User query: '{user_query}'")
        
        # Update status to processing
        categorization_status[session_id] = {
            'status': 'processing',
            'progress': 10,
            'message': 'Starting email categorization...'
        }
        
        # Call the categorization function
        print(f"[DEBUG] Calling gen_categories...")
        categories = gen_categories(email_list, user_query)
        print(f"[DEBUG] gen_categories returned: {categories}")
        
        # Update progress
        categorization_status[session_id] = {
            'status': 'processing',
            'progress': 70,
            'message': 'Organizing emails into categories...'
        }
        
        # Group emails by category
        print(f"[DEBUG] Grouping emails by category...")
        categorized_emails = {}
        
        for i, email in enumerate(email_list):
            if i < len(categories):
                category = categories[i]
            else:
                category = 'Others'
            
            if category not in categorized_emails:
                categorized_emails[category] = []
            
            categorized_emails[category].append(email)
        
        print(f"[DEBUG] Categorized emails: {list(categorized_emails.keys())}")
        print(f"[DEBUG] Category counts: {[(k, len(v)) for k, v in categorized_emails.items()]}")
        
        # Store results
        categorization_results[session_id] = {
            'categories': categorized_emails,
            'user_email': user_email,
            'total_emails': len(email_list),
            'query': user_query
        }
        
        # Don't save automatically - let user choose when to save
        # category_storage.save_categories(final_classification, user_query)
        
        # Update status to complete
        categorization_status[session_id] = {
            'status': 'completed',
            'progress': 100,
            'message': 'Categorization completed successfully!'
        }
        
        print(f"[DEBUG] Categorization completed successfully for session {session_id}")
        
    except IndexError as e:
        print(f"[DEBUG] IndexError in categorization: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Handle index error gracefully
        categorization_status[session_id] = {
            'status': 'index_error',
            'progress': 100,
            'message': 'Index error detected - proceeding with fallback categorization',
            'redirect': True
        }
        
        # Create a fallback categorization with all emails in one category
        categorization_results[session_id] = {
            'categories': {'All Emails': email_list},
            'user_email': user_email,
            'total_emails': len(email_list),
            'query': user_query
        }
        
    except Exception as e:
        print(f"[DEBUG] Exception in categorization: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Try simple categorization as fallback
        try:
            print(f"[DEBUG] Attempting fallback categorization...")
            from utils import simple_categorize
            categories = simple_categorize(email_list)
            
            # Group emails by category
            categorized_emails = {}
            for i, email in enumerate(email_list):
                if i < len(categories):
                    category = categories[i]
                else:
                    category = 'Others'
                
                if category not in categorized_emails:
                    categorized_emails[category] = []
                
                categorized_emails[category].append(email)
            
            # Store fallback results
            categorization_results[session_id] = {
                'categories': categorized_emails,
                'user_email': user_email,
                'total_emails': len(email_list)
            }
            
            categorization_status[session_id] = {
                'status': 'completed',
                'progress': 100,
                'message': 'Categorization completed with fallback method'
            }
            
            print(f"[DEBUG] Fallback categorization successful for session {session_id}")
            
        except Exception as fallback_error:
            print(f"[DEBUG] Fallback categorization also failed: {str(fallback_error)}")
            categorization_status[session_id] = {
                'status': 'error',
                'progress': 0,
                'message': f'Error: {str(e)}'
            }

@app.route('/categorize_status/<session_id>')
def categorize_status_check(session_id):
    """Check the status of categorization process"""
    try:
        print(f"[DEBUG] Status check for session: {session_id}")
        status = categorization_status.get(session_id, {
            'status': 'not_found',
            'progress': 0,
            'message': 'Session not found'
        })
        print(f"[DEBUG] Status response: {status}")
        return jsonify(status)
    except Exception as e:
        print(f"[DEBUG] Error in status check: {str(e)}")
        return jsonify({
            'status': 'error',
            'progress': 0,
            'message': f'Status check error: {str(e)}'
        }), 500

@app.route('/categorize_results/<session_id>')
def categorize_results(session_id):
    """Get categorization results"""
    if session_id in categorization_results:
        results = categorization_results[session_id]
        
        # Don't clean up stored data immediately - let the frontend handle cleanup
        # This allows for multiple requests to the same session
        
        # Check if this is an API request (from Next.js) or direct browser request
        if request.headers.get('Accept', '').startswith('application/json') or \
           'application/json' in request.headers.get('Content-Type', ''):
            # Return JSON for API requests
            return jsonify({
                'categories': results['categories'],
                'user_email': results['user_email'],
                'total_emails': results['total_emails'],
                'query': results.get('query', ''),
                'is_saved': False
            })
        else:
            # Return HTML template for direct browser requests
            return render_template('categorize.html', 
                                 categories=results['categories'],
                                 user_email=results['user_email'],
                                 total_emails=results['total_emails'],
                                 query=results.get('query', ''),
                                 is_saved=False)
    else:
        return jsonify({'error': 'Session not found or expired'}), 404

def cleanup_old_sessions(user_email, max_age_seconds=3600):
    """Clean up old sessions to prevent memory leaks"""
    current_time = int(time.time())
    sessions_to_remove = []
    
    print(f"[DEBUG] Cleanup: Checking sessions for {user_email}, max age: {max_age_seconds}s")
    print(f"[DEBUG] Current sessions: {list(categorization_status.keys())}")
    
    # Find old sessions for this user
    for session_id in list(categorization_status.keys()):
        if session_id.startswith(user_email):
            try:
                # Extract timestamp from session_id
                session_time = int(session_id.split('_')[1])
                age = current_time - session_time
                print(f"[DEBUG] Session {session_id} age: {age}s")
                if age > max_age_seconds:
                    sessions_to_remove.append(session_id)
                    print(f"[DEBUG] Marking session {session_id} for removal (too old)")
            except (IndexError, ValueError) as e:
                # If we can't parse the timestamp, remove the session
                print(f"[DEBUG] Cannot parse session {session_id}: {e}")
                sessions_to_remove.append(session_id)
    
    # Remove old sessions
    print(f"[DEBUG] Removing {len(sessions_to_remove)} old sessions")
    for session_id in sessions_to_remove:
        if session_id in categorization_status:
            del categorization_status[session_id]
        if session_id in categorization_results:
            del categorization_results[session_id]

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Flask backend is running',
        'authenticated': 'credentials' in session,
        'session_keys': list(session.keys())
    })

@app.route('/api/debug')
def debug_session():
    """Debug session information"""
    return jsonify({
        'session_keys': list(session.keys()),
        'has_credentials': 'credentials' in session,
        'session_id': request.cookies.get('session'),
        'cookies': dict(request.cookies)
    })

@app.route('/api/session-test')
def session_test():
    """Test endpoint to verify session functionality"""
    if 'test_counter' not in session:
        session['test_counter'] = 0
    session['test_counter'] += 1
    
    return jsonify({
        'session_id': request.cookies.get('session', 'No session cookie'),
        'test_counter': session['test_counter'],
        'session_keys': list(session.keys()),
        'has_credentials': 'credentials' in session,
        'has_oauth_state': 'oauth_state' in session,
        'oauth_state': session.get('oauth_state', 'No state stored')
    })

@retry_on_ssl_error(max_retries=3, base_delay=1.0)
def _fetch_emails_with_retry(email_client, max_results, query):
    """Helper function to fetch emails with retry logic"""
    return email_client.get_messages(max_results=max_results, query=query)

@retry_on_ssl_error(max_retries=2, base_delay=0.5)
def _get_user_profile_with_retry(service):
    """Helper function to get user profile with retry logic"""
    return service.users().getProfile(userId='me').execute()

@app.route('/api/emails')
def get_emails():
    """API endpoint to fetch emails (for AJAX requests)"""
    print(f"[DEBUG] /api/emails - Session keys: {list(session.keys())}")
    print(f"[DEBUG] /api/emails - Has credentials: {'credentials' in session}")
    
    if 'credentials' not in session:
        print("[DEBUG] /api/emails - No credentials in session")
        return jsonify({'error': 'Not authenticated', 'debug': 'No credentials in session'}), 401
    
    try:
        print("[DEBUG] /api/emails - Loading credentials from session")
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        email_client.add_service(service)
        
        # Get query parameters
        max_results = request.args.get('max_results', 100, type=int)
        query = request.args.get('q', '')
        
        print(f"[DEBUG] /api/emails - Fetching {max_results} emails")
        email_list = _fetch_emails_with_retry(email_client, max_results, query)
        
        # Get user profile for email address
        profile = email_client.profile
        user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'
        
        print(f"[DEBUG] /api/emails - Successfully fetched {len(email_list)} emails for {user_email}")
        return jsonify({'emails': email_list, 'total': len(email_list), 'user_email': user_email})
        
    except Exception as e:
        print(f"[DEBUG] /api/emails - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'debug': 'Exception occurred'}), 500

@retry_on_ssl_error(max_retries=3, base_delay=1.0)
def _fetch_email_with_retry(service, email_id):
    """Helper function to fetch email with retry logic"""
    return service.users().messages().get(
        userId='me', 
        id=email_id,
        format='full'
    ).execute()

@retry_on_ssl_error(max_retries=2, base_delay=0.5)
def _mark_email_read_with_retry(service, email_id):
    """Helper function to mark email as read with retry logic"""
    return service.users().messages().modify(
        userId='me',
        id=email_id,
        body={'removeLabelIds': ['UNREAD']}
    ).execute()

@app.route('/api/email/<email_id>')
def get_email_detail(email_id):
    """API endpoint to fetch specific email details with full content"""
    print(f"[DEBUG] /api/email/{email_id} - Session keys: {list(session.keys())}")
    print(f"[DEBUG] /api/email/{email_id} - Has credentials: {'credentials' in session}")
    
    if 'credentials' not in session:
        print(f"[DEBUG] /api/email/{email_id} - No credentials in session")
        return jsonify({'error': 'Not authenticated', 'debug': 'No credentials in session'}), 401
    
    try:
        print(f"[DEBUG] /api/email/{email_id} - Loading credentials from session")
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        email_client.add_service(service)
        
        print(f"[DEBUG] /api/email/{email_id} - Fetching email details")
        msg = _fetch_email_with_retry(service, email_id)
        
        print(f"[DEBUG] /api/email/{email_id} - Parsing email message")
        email_data = email_client.parse_message(msg)
        
        # Mark as read if it was unread
        if 'UNREAD' in msg.get('labelIds', []):
            print(f"[DEBUG] /api/email/{email_id} - Marking email as read")
            try:
                _mark_email_read_with_retry(service, email_id)
                email_data['is_unread'] = False
            except Exception as mark_read_error:
                print(f"[WARNING] Failed to mark email as read: {str(mark_read_error)}")
                # Don't fail the whole request if marking as read fails
                email_data['is_unread'] = True
        
        print(f"[DEBUG] /api/email/{email_id} - Successfully fetched email details")
        return jsonify(email_data)
        
    except Exception as e:
        print(f"[DEBUG] /api/email/{email_id} - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'debug': 'Exception occurred'}), 500

# NEW ENDPOINTS ADDED BELOW

@app.route('/api/email/<email_id>/details')
def get_email_details(email_id):
    """Get detailed email data including body content - alternative endpoint name"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        email_client.add_service(service)
        
        # Get the full email message
        msg = service.users().messages().get(
            userId='me', 
            id=email_id,
            format='full'
        ).execute()
        
        # Parse the message to get structured data
        email_data = email_client.parse_message(msg)
        
        # Add additional metadata
        email_data.update({
            'id': email_id,
            'thread_id': msg.get('threadId'),
            'label_ids': msg.get('labelIds', []),
            'size_estimate': msg.get('sizeEstimate'),
            'is_unread': 'UNREAD' in msg.get('labelIds', []),
            'is_important': 'IMPORTANT' in msg.get('labelIds', []),
            'is_starred': 'STARRED' in msg.get('labelIds', []),
        })
        
        return jsonify({
            'success': True,
            'email': email_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/email/<email_id>/mark-read', methods=['POST'])
def mark_email_read(email_id):
    """Mark email as read"""
    print(f"[DEBUG] /api/email/{email_id}/mark-read - Session keys: {list(session.keys())}")
    print(f"[DEBUG] /api/email/{email_id}/mark-read - Has credentials: {'credentials' in session}")
    
    if 'credentials' not in session:
        print(f"[DEBUG] /api/email/{email_id}/mark-read - No credentials in session")
        return jsonify({'error': 'Not authenticated', 'debug': 'No credentials in session'}), 401
    
    try:
        print(f"[DEBUG] /api/email/{email_id}/mark-read - Loading credentials from session")
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        print(f"[DEBUG] /api/email/{email_id}/mark-read - Marking email as read")
        # Remove the UNREAD label to mark as read
        result = _mark_email_read_with_retry(service, email_id)
        
        print(f"[DEBUG] /api/email/{email_id}/mark-read - Successfully marked as read")
        return jsonify({
            'success': True,
            'message': 'Email marked as read',
            'email_id': email_id,
            'label_ids': result.get('labelIds', [])
        })
        
    except Exception as e:
        print(f"[DEBUG] /api/email/{email_id}/mark-read - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False, 'debug': 'Exception occurred'}), 500

@app.route('/api/email/<email_id>/mark-unread', methods=['POST'])
def mark_email_unread(email_id):
    """Mark email as unread (bonus endpoint)"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        # Add the UNREAD label to mark as unread
        result = service.users().messages().modify(
            userId='me',
            id=email_id,
            body={'addLabelIds': ['UNREAD']}
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Email marked as unread',
            'email_id': email_id,
            'label_ids': result.get('labelIds', [])
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/email/<email_id>', methods=['DELETE'])
def delete_email(email_id):
    """Delete email (move to trash)"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        # Move email to trash (Gmail doesn't permanently delete via API by default)
        result = service.users().messages().trash(
            userId='me',
            id=email_id
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Email moved to trash',
            'email_id': email_id,
            'thread_id': result.get('threadId')
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/email/<email_id>/restore', methods=['POST'])
def restore_email(email_id):
    """Restore email from trash (bonus endpoint)"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        # Remove email from trash
        result = service.users().messages().untrash(
            userId='me',
            id=email_id
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Email restored from trash',
            'email_id': email_id,
            'thread_id': result.get('threadId')
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/email/<email_id>/star', methods=['POST'])
def star_email(email_id):
    """Star/unstar email (bonus endpoint)"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        # Get current message to check if it's already starred
        msg = service.users().messages().get(userId='me', id=email_id).execute()
        is_starred = 'STARRED' in msg.get('labelIds', [])
        
        if is_starred:
            # Remove star
            result = service.users().messages().modify(
                userId='me',
                id=email_id,
                body={'removeLabelIds': ['STARRED']}
            ).execute()
            message = 'Email unstarred'
        else:
            # Add star
            result = service.users().messages().modify(
                userId='me',
                id=email_id,
                body={'addLabelIds': ['STARRED']}
            ).execute()
            message = 'Email starred'
        
        return jsonify({
            'success': True,
            'message': message,
            'email_id': email_id,
            'is_starred': not is_starred,
            'label_ids': result.get('labelIds', [])
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/load-inbox')
def load_inbox():
    """API endpoint to load inbox data for the loading page"""
    print(f"[DEBUG] /api/load-inbox - Session keys: {list(session.keys())}")
    print(f"[DEBUG] /api/load-inbox - Has credentials: {'credentials' in session}")
    print(f"[DEBUG] /api/load-inbox - Request cookies: {dict(request.cookies)}")
    print(f"[DEBUG] /api/load-inbox - Session ID: {request.cookies.get('session')}")
    
    if 'credentials' not in session:
        print("[DEBUG] /api/load-inbox - No credentials in session")
        return jsonify({'error': 'Not authenticated', 'redirect': '/', 'debug': 'No credentials in session'}), 401
    
    try:
        print("[DEBUG] /api/load-inbox - Loading credentials from session")
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        email_client.add_service(service)
        
        # Get user profile info
        print("[DEBUG] /api/load-inbox - Getting user profile")
        profile = _get_user_profile_with_retry(service)
        user_email = profile.get('emailAddress', 'Unknown')
        
        # Get emails
        print("[DEBUG] /api/load-inbox - Getting emails")
        if email_client.has_service and email_client.email_list!=None:
            email_list = email_client.email_list
        else:
            email_list = _fetch_emails_with_retry(email_client, 50, '')
        
        print(f"[DEBUG] /api/load-inbox - Successfully loaded {len(email_list)} emails for {user_email}")
        return jsonify({
            'success': True,
            'user_email': user_email,
            'emails': email_list,
            'total_emails': len(email_list)
        })
        
    except Exception as e:
        print(f"[DEBUG] /api/load-inbox - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'debug': 'Exception occurred'}), 500

@app.route('/login')
def login_page():
    """Serve the login page"""
    return render_template('login.html')

@app.route('/loading')
def loading_page():
    """Serve the loading page"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    return render_template('loading.html')

@app.route('/categorize/loading')
def categorize_loading_page():
    """Serve the categorize loading page"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    
    # Get parameters from URL
    session_id = request.args.get('session_id', '')
    user_email = request.args.get('user_email', '')
    total_emails = request.args.get('total_emails', '0')
    
    return render_template('categorize_loading.html', 
                         session_id=session_id,
                         user_email=user_email,
                         total_emails=total_emails)

@app.route('/chat')
def chat_page():
    """Dedicated chat interface for interacting with emails"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    
    try:
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        return render_template('chat.html', user_email=user_email)
    except Exception as e:
        return f"Error: {str(e)} <a href='/logout'>Try again</a>"

@app.route('/reply/<email_id>')
def reply_page(email_id):
    """Reply generation page for a specific email - DEPRECATED: Use API endpoint instead"""
    # This route is kept for backward compatibility but redirects to inbox
    # The reply generation is now handled via AJAX calls to /api/generate-reply
    return redirect(url_for('inbox'))

@app.route('/api/generate-reply', methods=['POST'])
def generate_reply():
    """Generate an AI-powered email reply"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        print(f"[DEBUG] Generate reply request received: {data.keys()}")
        
        email_id = data.get('email_id')
        tone = data.get('tone', 'professional')
        subject = data.get('subject', '')
        sender = data.get('sender', '')
        body = data.get('body', '')
        
        print(f"[DEBUG] Generate reply params:")
        print(f"  - Email ID: {email_id}")
        print(f"  - Tone: {tone}")
        print(f"  - Subject: {subject}")
        print(f"  - Sender: {sender}")
        print(f"  - Body length: {len(body)}")
        
        if not body:
            return jsonify({'error': 'Email body is empty'}), 400
        
        # Get user's name from email if available
        user_name = "there"  # Default
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', '')
            if user_email and '@' in user_email:
                user_name = user_email.split('@')[0].title()
        
        # Create prompt for Gemini
        prompt = f"""You are an AI assistant helping to write email replies. Generate a {tone} reply to the following email:

From: {sender}
Subject: {subject}

Email content:
{body}

Instructions:
1. Write a {tone} reply that appropriately addresses all points in the email
2. Keep the tone {tone} throughout
3. Be concise but thorough
4. Include a proper greeting using the sender's name if available
5. Sign off appropriately (you can use "Best regards" or similar)
6. Make the reply feel natural and human-written
7. If the email asks questions, make sure to answer them
8. If the email requires action, acknowledge what you'll do
9. Do not include a signature line with contact details

Generate only the reply text, without any additional commentary or explanations. Start directly with the greeting.
"""
        
        print(f"[DEBUG] Sending prompt to Gemini...")
        
        # Call Gemini API
        import google.generativeai as genai
        genai.configure(api_key="AIzaSyBCW5yfwtmz7qjsxLgZkz6v-nKtcJI2UfA")
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            print("[ERROR] No response from Gemini")
            return jsonify({'error': 'No response from AI'}), 500
        
        # Clean up the response
        reply_text = response.text.strip()
        
        print(f"[DEBUG] Generated reply length: {len(reply_text)}")
        print(f"[DEBUG] Reply preview: {reply_text[:100]}...")
        
        return jsonify({
            'success': True,
            'reply': reply_text,
            'tone': tone
        })
        
    except Exception as e:
        print(f"[ERROR] Generate reply error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/auth/login')
def login():
    print(f"[DEBUG] /login - Session keys before: {list(session.keys())}")
    print(f"[DEBUG] /login - Session ID before: {request.cookies.get('session')}")
    
    session.permanent = True
    flow = get_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Store the state in the session
    session['oauth_state'] = state
    
    print(f"[DEBUG] /login - Generated state: {state}")
    print(f"[DEBUG] /login - Session keys after: {list(session.keys())}")
    print(f"[DEBUG] /login - Stored oauth_state: {session.get('oauth_state')}")
    print(f"[DEBUG] /login - Authorization URL: {authorization_url}")
    
    return redirect(authorization_url)

@app.route('/login/google/authorized')
def authorized():
    # Verify state for security
    print(f"[DEBUG] /login/google/authorized - Session keys before: {list(session.keys())}")
    print(f"[DEBUG] /login/google/authorized - Request args: {dict(request.args)}")
    print(f"[DEBUG] /login/google/authorized - Session ID: {request.cookies.get('session')}")
    print(f"[DEBUG] /login/google/authorized - All cookies: {dict(request.cookies)}")
    
    request_state = request.args.get('state')
    session_state = session.get('oauth_state')
    
    print(f"[DEBUG] /login/google/authorized - Request state: {request_state}")
    print(f"[DEBUG] /login/google/authorized - Session state: {session_state}")
    
    # For development, be more lenient with state validation
    # In production, you should always validate the state parameter
    if not request_state:
        print(f"[DEBUG] /login/google/authorized - No state parameter in request")
        return 'No state parameter provided', 400
    
    # Skip state validation for now to debug session issues
    # TODO: Re-enable state validation once session is working
    print("[DEBUG] /login/google/authorized - Skipping state validation for debugging")
    
    try:
        print("[DEBUG] /login/google/authorized - Creating flow and fetching token")
        flow = get_flow()
        flow.fetch_token(authorization_response=request.url)
        
        # Store credentials in session
        credentials = flow.credentials
        session['credentials'] = pickle.dumps(credentials)
        session['oauth_state'] = request_state  # Store the state for future reference
        session.permanent = True  # Make session permanent
        
        print(f"[DEBUG] /login/google/authorized - Session keys after: {list(session.keys())}")
        print(f"[DEBUG] /login/google/authorized - Credentials stored successfully")
        
        # Test if we can read the credentials back
        test_creds = pickle.loads(session['credentials'])
        print(f"[DEBUG] /login/google/authorized - Credentials test: {test_creds is not None}")
        
        # Redirect back to loading page
        return redirect(url_for('loading_page'))
    except Exception as e:
        print(f"[DEBUG] /login/google/authorized - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return f"Authorization failed: {str(e)} <a href='/'>Try again</a>"

@app.route('/logout')
def logout():
    session.pop('credentials', None)
    session.pop('oauth_state', None)
    return redirect(url_for('login_page'))
    
@app.route('/api/save-categories', methods=['POST'])
def save_categories():
    """Save current categories to local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        # Get categories from request
        data = request.get_json()
        categories = data.get('categories', {})
        print("-------------------------------- categories --------------------------------")
        print(categories)
        query = data.get('query', '')
        # Initialize category storage and save
        category_storage = CategoryStorage(user_email)
        success = category_storage.save_categories(categories, query)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Categories saved successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to save categories'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/save-folders', methods=['POST'])
def save_folders():
    """Save folder structure to local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        # Get folders from request
        data = request.get_json()
        folders = data.get('folders', {})
        
        # Initialize category storage and save
        category_storage = CategoryStorage(user_email)
        success = category_storage.save_folders(folders)
        print("-------------------------------- folders --------------------------------")
        print(folders)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Folders saved successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to save folders'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/load-saved-categories')
def load_saved_categories():
    """Load saved categories from local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        # Initialize category storage and load
        category_storage = CategoryStorage(user_email)
        saved_data = category_storage.load_categories()
        
        if saved_data:
            # Redirect to categorize page with saved data
            return redirect(url_for('categorize'))
        else:
            return jsonify({
                'success': False,
                'message': 'No saved categories found'
            }), 404
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/load-saved-folders')
def load_saved_folders():
    """Load saved folders from local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        # Initialize category storage and load
        category_storage = CategoryStorage(user_email)
        saved_data = category_storage.load_folders()
        
        if saved_data:
            return jsonify({
                'success': True,
                'data': saved_data
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No saved folders found'
            }), 404
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/has-saved-data')
def has_saved_data():
    """Check if user has saved categories or folders"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        # Initialize category storage and check
        category_storage = CategoryStorage(user_email)
        
        return jsonify({
            'success': True,
            'has_categories': category_storage.has_saved_categories(),
            'has_folders': category_storage.has_saved_folders()
        })
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/chat-with-mail', methods=['POST'])
def chat_with_mail():
    """Chat with emails using Gemini AI"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        user_query = data.get('query', '')
        
        if not user_query:
            return jsonify({'error': 'No query provided'}), 400
        
        # Load user's actual emails
        if email_client.has_service and email_client.email_list != None:
            emails = email_client.email_list
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            emails = email_client.get_messages(max_results=100)
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        
        if not emails:
            return jsonify({'error': 'No emails found to analyze'}), 404
        
        print(f"[DEBUG] Chat with mail - Processing {len(emails)} emails for query: {user_query}")
        
        # Prepare email context for Gemini (limit to most recent 20 emails to avoid token limits)
        recent_emails = emails[:20]
        email_context = f"Here are the user's most recent emails (from {user_email}):\n\n"
        
        for i, email in enumerate(recent_emails, 1):
            email_context += f"Email {i}:\n"
            email_context += f"Subject: {email.get('subject', 'No subject')}\n"
            email_context += f"From: {email.get('sender', 'Unknown')}\n"
            email_context += f"Date: {email.get('date', 'Unknown')}\n"
            email_context += f"Preview: {email.get('snippet', 'No preview')[:150]}...\n"
            email_context += f"Read Status: {'Read' if not email.get('is_unread', False) else 'Unread'}\n"
            email_context += "-" * 40 + "\n\n"
        
        # Create the prompt for Gemini
        prompt = f"""You are an AI assistant helping users understand and find information in their emails. 

{email_context}

User Query: "{user_query}"

Please analyze the emails and provide a helpful response. You should:

1. **Find the most relevant emails** to the user's query
2. **Answer their question** or fulfill their request based on the email content
3. **Reference specific emails** when relevant (by subject or sender)
4. **Be conversational and helpful** - explain what you found
5. **Summarize key information** if they're asking for updates or overviews
6. **Suggest actions** if appropriate (like "You should reply to..." or "This seems urgent...")

Guidelines:
- If asking about urgent emails, look for keywords like "urgent", "ASAP", "deadline", etc.
- If asking about specific people, match sender names
- If asking about topics, match subjects and content
- If asking for summaries, provide a concise overview
- Be specific about which emails you're referencing

Format your response in a natural, conversational way. Use **bold** for emphasis and bullet points where helpful.
"""
        
        # Call Gemini API
        import google.generativeai as genai
        genai.configure(api_key="AIzaSyBCW5yfwtmz7qjsxLgZkz6v-nKtcJI2UfA")
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return jsonify({'error': 'No response from AI'}), 500
        
        print(f"[DEBUG] Chat with mail - Gemini response received: {len(response.text)} characters")
        
        # Find relevant emails based on the query and response
        relevant_emails = []
        query_lower = user_query.lower()
        response_lower = response.text.lower()
        
        # Score emails based on relevance
        email_scores = []
        for email in emails[:30]:  # Check first 30 emails
            score = 0
            subject = email.get('subject', '').lower()
            sender = email.get('sender', '').lower()
            snippet = email.get('snippet', '').lower()
            
            # Query matching
            query_words = query_lower.split()
            for word in query_words:
                if len(word) > 3:  # Only check meaningful words
                    if word in subject:
                        score += 3
                    if word in sender:
                        score += 2
                    if word in snippet:
                        score += 1
            
            # Special query handling
            if 'urgent' in query_lower and ('urgent' in subject or 'asap' in subject or '!' in subject):
                score += 5
            if 'unread' in query_lower and email.get('is_unread', False):
                score += 4
            if 'recent' in query_lower or 'latest' in query_lower:
                score += 1  # Recent emails get slight boost
            if 'meeting' in query_lower and 'meeting' in subject:
                score += 4
            
            # Check if email is mentioned in AI response
            if subject and len(subject) > 10:
                subject_words = subject.split()[:4]  # First few words of subject
                for word in subject_words:
                    if len(word) > 4 and word.lower() in response_lower:
                        score += 2
            
            if score > 0:
                email_scores.append((score, email))
        
        # Sort by score and take top emails
        email_scores.sort(key=lambda x: x[0], reverse=True)
        relevant_emails = [email for score, email in email_scores[:5]]
        
        # If no scored emails, but query seems to want recent emails, include most recent
        if not relevant_emails and any(word in query_lower for word in ['latest', 'recent', 'new', 'today', 'inbox']):
            relevant_emails = emails[:3]
        
        # Format relevant emails for response
        formatted_emails = []
        for email in relevant_emails:
            formatted_emails.append({
                'id': email.get('id', ''),
                'subject': email.get('subject', 'No subject'),
                'sender': email.get('sender', 'Unknown'),
                'date': email.get('date', 'Unknown'),
                'snippet': email.get('snippet', 'No preview'),
                'is_unread': email.get('is_unread', False)
            })
        
        print(f"[DEBUG] Chat with mail - Found {len(formatted_emails)} relevant emails")
        
        return jsonify({
            'success': True,
            'response': response.text,
            'relevant_emails': formatted_emails,
            'total_emails_analyzed': len(emails)
        })
        
    except Exception as e:
        print(f"[ERROR] Chat with mail error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    # Only for development - remove in production
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
    
    print("="*60)
    print("🚀 STREAM EMAIL MANAGEMENT SYSTEM")
    print("="*60)
    print("✅ Static Frontend: http://localhost:5000")
    print("📧 Gmail Integration: Ready")
    print("🤖 AI Categorization: Ready")
    print("📱 EmailViewer: Enhanced")
    print("="*60)
    print("👉 Open your browser and go to: http://localhost:5000")
    print("="*60)
    
    app.run(host='localhost', port=5000, debug=True)