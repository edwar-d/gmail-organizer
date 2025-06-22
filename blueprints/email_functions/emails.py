from flask import Blueprint, request, jsonify, session, g
from googleapiclient.discovery import build
import pickle
import ssl
from googleapiclient.errors import HttpError
import time
import random
from utils import EmailClient

# Create blueprint
emails_bp = Blueprint('emails', __name__, url_prefix='/api')

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
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator

@retry_on_ssl_error(max_retries=3, base_delay=1.0)
def _fetch_emails_with_retry(email_client, max_results, query):
    """Helper function to fetch emails with retry logic"""
    return email_client.get_messages(max_results=max_results, query=query)

@retry_on_ssl_error(max_retries=2, base_delay=0.5)
def _get_user_profile_with_retry(service):
    """Helper function to get user profile with retry logic"""
    return service.users().getProfile(userId='me').execute()

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

@emails_bp.route('/emails')
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
        
        # Get the email client from the g object
        email_client = g.email_client
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

@emails_bp.route('/email/<email_id>')
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
        
        # Get the email client from the g object
        email_client = g.email_client
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

@emails_bp.route('/email/<email_id>/details')
def get_email_details(email_id):
    """Get detailed email data including body content - alternative endpoint name"""
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        creds = pickle.loads(session['credentials'])
        service = build('gmail', 'v1', credentials=creds)
        
        # Get the email client from the g object
        email_client = g.email_client
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

@emails_bp.route('/email/<email_id>/mark-read', methods=['POST'])
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

@emails_bp.route('/email/<email_id>/mark-unread', methods=['POST'])
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

@emails_bp.route('/email/<email_id>', methods=['DELETE'])
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

@emails_bp.route('/email/<email_id>/restore', methods=['POST'])
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

@emails_bp.route('/email/<email_id>/star', methods=['POST'])
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

@emails_bp.route('/load-inbox')
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
        
        # Get the email client from the g object
        email_client = g.email_client
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

@emails_bp.route('/generate-reply', methods=['POST'])
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
        email_client = g.email_client
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

@emails_bp.route('/chat-with-mail', methods=['POST'])
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
        email_client = g.email_client
        if email_client.has_service and email_client.email_list != None:
            emails = email_client.email_list
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        else:
            creds = pickle.loads(session['credentials'])
            service = build('gmail', 'v1', credentials=creds)
            email_client.add_service(service)
            emails = email_client.get_messages(max_results=100)
            user_email = email_client.profile.get('emailAddress', 'Unknown') if email_client.profile else 'Unknown'
        
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