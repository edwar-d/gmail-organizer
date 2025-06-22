from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, g
from googleapiclient.discovery import build
import pickle
import time
import uuid
from utils import EmailClient, gen_categories, CategoryStorage

# Create blueprint
categories_bp = Blueprint('categories', __name__)

# Global dictionary to store categorization results (kept for API compatibility)
categorization_results = {}
categorization_status = {}

@categories_bp.route('/categorize')
def categorize():
    """Categorize emails and display results immediately"""
    if 'credentials' not in session:
        return redirect(url_for('login_page'))
    
    # Get the user query from URL parameters
    user_query = request.args.get('query', '')
    force_new = request.args.get('force_new', 'false').lower() == 'true'
    recategorize = request.args.get('recategorize', 'false').lower() == 'true'
    
    try:
        email_client = g.email_client
        if email_client.has_service and email_client.email_list != None:
            email_list = email_client.email_list
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'

        # Validate email_list
        if not email_list or len(email_list) == 0:
            return "No emails found to categorize. <a href='/inbox'>Go back</a>"

        # Initialize category storage
        category_storage = CategoryStorage(user_email)
        
        # Check if we have saved categories and user isn't forcing a new categorization
        # AND no new query is provided (if there's a new query, always generate new categories)
        if not force_new and not recategorize and not user_query and category_storage.has_saved_categories():
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
        if request.args.get('loading') == 'true' or user_query or recategorize:
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

@categories_bp.route('/api/categorize')
def api_categorize():
    """API endpoint to get categorized emails as JSON"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_query = request.args.get('query', '')
    
    try:
        email_client = g.email_client
        if email_client.has_service and email_client.email_list != None:
            email_list = email_client.email_list
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'

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

@categories_bp.route('/categorize_status/<session_id>')
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

@categories_bp.route('/categorize_results/<session_id>')
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

@categories_bp.route('/api/save-categories', methods=['POST'])
def save_categories():
    """Save current categories to local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        email_client = g.email_client
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
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

@categories_bp.route('/api/save-folders', methods=['POST'])
def save_folders():
    """Save folder structure to local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        email_client = g.email_client
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
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

@categories_bp.route('/api/load-saved-categories')
def load_saved_categories():
    """Load saved categories from local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        email_client = g.email_client
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
        # Initialize category storage and load
        category_storage = CategoryStorage(user_email)
        saved_data = category_storage.load_categories()
        
        if saved_data:
            return jsonify({
                'success': True,
                'data': saved_data
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No saved categories found'
            }), 404
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@categories_bp.route('/api/load-saved-folders')
def load_saved_folders():
    """Load saved folders from local storage"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        email_client = g.email_client
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
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

@categories_bp.route('/api/has-saved-data')
def has_saved_data():
    """Check if user has saved categories or folders"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Get user email
        email_client = g.email_client
        if email_client.has_service and email_client.profile:
            user_email = email_client.profile.get('emailAddress', 'Unknown')
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
        # Initialize category storage and check
        category_storage = CategoryStorage(user_email)
        
        return jsonify({
            'success': True,
            'has_categories': category_storage.has_saved_categories(),
            'has_folders': category_storage.has_saved_folders()
        })
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500
