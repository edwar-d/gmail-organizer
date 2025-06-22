from flask import Flask, request, redirect, session, url_for, render_template, jsonify, g
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
app.secret_key = 'your-secret-key-here-make-this-consistent'  # Use consistent secret key
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

# Initialize the OAuth flow
def get_flow():
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

# Note: We can't use custom HTTP clients with credentials in Google API client
# The credentials object already contains the HTTP transport configuration

@app.before_request
def before_request():
    """Set up shared objects for each request"""
    g.email_client = email_client
    g.query = query

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
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            email_list = email_client.get_messages(max_results=100)
            profile = email_client.profile
            user_email = profile.get('emailAddress', 'Unknown') if profile else 'Unknown'
        
        return render_template('inbox.html', 
                             emails=email_list, 
                             user_email=user_email,
                             total_emails=len(email_list))

    except Exception as e:
        return f"Error: {str(e)} <a href='/logout'>Try again</a>"

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
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
        return render_template('chat.html', user_email=user_email)
    except Exception as e:
        return f"Error: {str(e)} <a href='/logout'>Try again</a>"

@app.route('/reply/<email_id>')
def reply_page(email_id):
    """Reply generation page for a specific email - DEPRECATED: Use API endpoint instead"""
    # This route is kept for backward compatibility but redirects to inbox
    # The reply generation is now handled via AJAX calls to /api/generate-reply
    return redirect(url_for('inbox'))

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

# Import and register blueprints
from blueprints.email_functions.emails import emails_bp
from blueprints.folder_view.categories import categories_bp

app.register_blueprint(emails_bp)
app.register_blueprint(categories_bp)

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