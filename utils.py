import base64
from datetime import timedelta, datetime
import re
from html import unescape
import json
import os
import hashlib

#from langchain_ollama.llms import OllamaLLM
#from langchain_core.prompts import ChatPromptTemplate


class EmailClient:
    def __init__(self):
        self.service = None
        self.has_service = False
        self.email_list = None
        self.profile = None
        
    def add_service(self, service):
        """Initialize Gmail service with credentials"""
        self.has_service = True
        self.service = service
        self.profile = service.users().getProfile(userId='me').execute()
        
    def get_messages(self, max_results=50, query=''):
        """Fetch email messages"""
        try:
            results = self.service.users().messages().list(
                userId='me', 
                maxResults=max_results,
                q=query
            ).execute()
            messages = results.get('messages', [])
            
            email_list = []
            for message in messages:
                msg = self.service.users().messages().get(
                    userId='me', 
                    id=message['id'],
                    format='full'
                ).execute()
                
                email_data = self.parse_message(msg)
                email_list.append(email_data)

            self.email_list = email_list

            return email_list
        except Exception as error:
            print(f'An error occurred: {error}')
            return []
    
    def parse_message(self, message, include_html=False):
        """Parse Gmail message into readable format"""
        headers = message['payload'].get('headers', [])
        
        # Extract headers
        subject = self.get_header(headers, 'Subject') or '(No Subject)'
        sender = self.get_header(headers, 'From') or 'Unknown Sender'
        date = self.get_header(headers, 'Date') or ''
        to = self.get_header(headers, 'To') or ''
        
        # Clean up sender name and email
        sender = self.clean_sender(sender)
        
        # Parse date
        formatted_date = self.parse_date(date)
        
        # Extract both HTML and plain text body
        body_data = self.get_body_content(message['payload'])
        
        # Check if read/unread
        labels = message.get('labelIds', [])
        is_unread = 'UNREAD' in labels
        
        # Clean snippet
        snippet = message.get('snippet', '')
        snippet = self.clean_snippet(snippet)
        
        result = {
            'id': message['id'],
            'subject': subject,
            'sender': sender,
            'date': formatted_date,
            'to': to,
            'body': body_data['plain_text'],
            'content': body_data['plain_text'],  # Alias for compatibility
            'is_unread': is_unread,
            'snippet': snippet,
            'labels': labels
        }
        
        # Add HTML body if available
        if body_data['html_content']:
            result['html_body'] = body_data['html_content']
            
        return result
    
    def get_header(self, headers, name):
        """Get specific header value"""
        for header in headers:
            if header['name'].lower() == name.lower():
                return header['value']
        return None
    
    def clean_sender(self, sender):
        """Clean up sender name and email format"""
        if not sender:
            return 'Unknown Sender'
        
        # Extract name from "Name <email@domain.com>" format
        match = re.match(r'^(.*?)\s*<(.+?)>$', sender)
        if match:
            name = match.group(1).strip().strip('"')
            email = match.group(2).strip()
            return name if name else email
        
        return sender
    def parse_date(self, date_str):
        """Parse and format date string"""
        if not date_str:
            return 'Unknown Date'
        
        try:
            # Remove timezone info in parentheses for easier parsing
            date_clean = re.sub(r'\s*\([^)]+\)$', '', date_str)
            
            # Common date formats in email headers
            formats = [
                '%a, %d %b %Y %H:%M:%S %z',
                '%a, %d %b %Y %H:%M:%S',
                '%d %b %Y %H:%M:%S %z',
                '%d %b %Y %H:%M:%S',
                '%a, %d %b %Y %H:%M:%S %Z',
                '%Y-%m-%d %H:%M:%S'
            ]
            
            for fmt in formats:
                try:
                    parsed_date = datetime.strptime(date_clean.strip(), fmt)
                    return parsed_date.strftime('%m/%d/%Y %I:%M %p')
                except ValueError:
                    continue
            
            # If all parsing fails, return original date
            return date_str
        except Exception:
            return date_str
    
    def clean_snippet(self, snippet):
        """Clean up email snippet"""
        if not snippet:
            return ''
        
        # Remove extra whitespace and newlines
        cleaned = re.sub(r'\s+', ' ', snippet).strip()
        
        # Truncate if too long
        if len(cleaned) > 100:
            cleaned = cleaned[:97] + '...'
        
        return cleaned
    
    def get_body(self, payload, include_html=False):
        """Extract email body from payload"""
        body = ""
        
        def extract_text_from_part(part):
            """Recursively extract text from email parts"""
            if part.get('mimeType') == 'text/plain':
                if 'data' in part.get('body', {}):
                    data = part['body']['data']
                    return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            elif part.get('mimeType') == 'text/html':
                if 'data' in part.get('body', {}):
                    data = part['body']['data']
                    html_content = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                    # Return HTML content if requested, otherwise strip HTML tags
                    if include_html:
                        return html_content
                    else:
                        return self.strip_html(html_content)
            elif 'parts' in part:
                # Recursively check parts
                for subpart in part['parts']:
                    text = extract_text_from_part(subpart)
                    if text:
                        return text
            return ""
        
        if 'parts' in payload:
            # Multi-part message
            for part in payload['parts']:
                body = extract_text_from_part(part)
                if body:
                    break
        else:
            # Single-part message
            if payload.get('body', {}).get('data'):
                data = payload['body']['data']
                body = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                if payload.get('mimeType') == 'text/html' and not include_html:
                    body = self.strip_html(body)
        
        return body.strip()
    
    def strip_html(self, html_content):
        """Strip HTML tags and return plain text"""
        if not html_content:
            return ''
        
        # Remove HTML tags
        clean = re.compile('<.*?>')
        text = re.sub(clean, '', html_content)
        
        # Decode HTML entities
        text = unescape(text)
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def get_body_content(self, payload):
        """Extract both HTML and plain text body from payload"""
        plain_text = ""
        html_content = ""
        
        def extract_content_from_part(part):
            """Recursively extract both plain text and HTML from email parts"""
            plain = ""
            html = ""
            
            if part.get('mimeType') == 'text/plain':
                if 'data' in part.get('body', {}):
                    data = part['body']['data']
                    plain = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            elif part.get('mimeType') == 'text/html':
                if 'data' in part.get('body', {}):
                    data = part['body']['data']
                    html = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            elif 'parts' in part:
                # Recursively check parts
                for subpart in part['parts']:
                    sub_plain, sub_html = extract_content_from_part(subpart)
                    if sub_plain and not plain:
                        plain = sub_plain
                    if sub_html and not html:
                        html = sub_html
            
            return plain, html
        
        if 'parts' in payload:
            # Multi-part message
            for part in payload['parts']:
                part_plain, part_html = extract_content_from_part(part)
                if part_plain and not plain_text:
                    plain_text = part_plain
                if part_html and not html_content:
                    html_content = part_html
        else:
            # Single-part message
            if payload.get('body', {}).get('data'):
                data = payload['body']['data']
                content = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                
                if payload.get('mimeType') == 'text/html':
                    html_content = content
                    plain_text = self.strip_html(content)
                else:
                    plain_text = content
        
        # If we only have HTML, generate plain text from it
        if html_content and not plain_text:
            plain_text = self.strip_html(html_content)
        
        # If we only have plain text, check if it looks like HTML
        if plain_text and not html_content and '<' in plain_text and '>' in plain_text:
            # This might be HTML content in a plain text field
            html_content = plain_text
        
        return {
            'plain_text': plain_text.strip(),
            'html_content': html_content.strip() if html_content else None
        }

class QuerySaver():
    def __init__(self):
        self.query = ""
    
    def add_query_content(self, additional_query):
        # Reset the query instead of accumulating
        self.query = additional_query.strip()


def simple_categorize(emails):
    """Simple categorization without AI - fallback function"""
    categories = []
    
    for email in emails:
        subject = email.get("subject", "").lower()
        
        if any(word in subject for word in ["meeting", "calendar", "appointment", "schedule"]):
            categories.append("Meetings")
        elif any(word in subject for word in ["project", "task", "deadline", "work", "team"]):
            categories.append("Work")
        elif any(word in subject for word in ["newsletter", "news", "update", "weekly", "daily"]):
            categories.append("Newsletters")
        elif any(word in subject for word in ["bill", "payment", "invoice", "bank", "statement"]):
            categories.append("Finance")
        elif any(word in subject for word in ["security", "alert", "login", "password", "verification"]):
            categories.append("Security")
        elif any(word in subject for word in ["social", "facebook", "twitter", "linkedin", "instagram"]):
            categories.append("Social")
        else:
            categories.append("Others")
    
    return categories


# Test the fixed code
def gen_categories(unformated_emails, user_query=""):
    emails = []
    for email in unformated_emails:
        emails.append([email["subject"]])

    # Try AI categorization first, fallback to simple categorization
    try:
        if user_query == "":
            category_init_template = """
                                    You are an email classifier. Your task is simple:

                                    1. Read the email headings below
                                    2. You MUST classify all headings using NO MORE THAN 7 UNIQUE CATEGORIES. If you use more than 7 unique categories, you will instantly fail.
                                    3. Assign each email to exactly one category.
                                    4. If you are unsure, use "Others" as the category.

                                    Email headings:
                                    {emails}

                                    Instructions:
                                    - You are absolutely forbidden from using more than 7 unique category names in your entire output.
                                    - Assign one category per email, in the same order as the email list.
                                    - Use "Others" for any heading that does not clearly fit into one of your chosen categories.
                                    - Output ONLY in this format (do not number, do not add extra text):

                                    Heading --- Category (NO MORE THAN 7 UNIQUE CATEGORIES)
                                    Heading --- Category
                                    Heading --- Category
                                """
        else:
            category_init_template = """
                                    You are an email classifier. Your task is simple:

                                    1. Read the email headings below
                                    2. You MUST classify all headings using NO MORE THAN 7 UNIQUE CATEGORIES. If you use more than 7 unique categories, you will instantly fail.
                                    3. Assign each email to exactly one category.
                                    4. If you are unsure, use "Others" as the category.

                                    Email headings:
                                    {emails}

                                    THESE ARE THE USERS CUSTOM INSTRUCTIONS. PLEASE BE SURE TO TAKE THEM INTO ACCOUNT(if not you fail.):
                                    {custom_instruction}

                                    Instructions:
                                    - You are absolutely forbidden from using more than 7 unique category names in your entire output.
                                    - Assign one category per email, in the same order as the email list.
                                    - Use "Others" for any heading that does not clearly fit into one of your chosen categories.
                                    - Output ONLY in this format (do not number, do not add extra text):

                                    Heading --- Category (NO MORE THAN 7 UNIQUE CATEGORIES)
                                    Heading --- Category
                                    Heading --- Category
                                """
            
        email_headings = []
        for i, email in enumerate(emails, 1):
            # Extract the heading from the nested list structure
            heading = email[0] if isinstance(email, list) and len(email) > 0 else str(email)
            email_headings.append(f"{i}. {heading}")
        
        formatted_emails = "\n".join(email_headings)

        if user_query == "":
            category_init_template = category_init_template.format(emails=formatted_emails)
        else:
            category_init_template = category_init_template.format(emails=formatted_emails, custom_instruction=user_query)

        gemini_input = category_init_template

        api_key="key goes here"

        import google.generativeai as genai

        print("[DEBUG] Attempting AI categorization with Gemini...")
        
        # Configure with your API key
        genai.configure(api_key=api_key)

        # Use Gemini Flash instead of Pro
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(gemini_input)
        
        if not response or not response.text:
            print("Warning: Empty response from Gemini, using simple categorization")
            return simple_categorize(unformated_emails)
        
        print(f"[DEBUG] Gemini response: {response.text[:200]}...")
        
        output = []
        entries = response.text.strip().split("\n")
        
        for entry in entries:
            entry = entry.strip()
            if entry == "" or not entry:
                continue
            
            # Try to extract category from the response
            if " --- " in entry:
                parts = entry.split(" --- ")
                if len(parts) >= 2:
                    category = parts[1].strip()
                    # Clean up category name
                    category = category.replace("(NO MORE THAN 7 UNIQUE CATEGORIES)", "").strip()
                    output.append(category)
                else:
                    output.append('Others')
            else:
                # If the format is unexpected, try to extract the last word as category
                words = entry.split()
                if len(words) > 0:
                    output.append(words[-1].strip())
                else:
                    output.append('Others')
        
        # Ensure we have the same number of categories as emails
        if len(output) != len(unformated_emails):
            print(f"Warning: Category count ({len(output)}) doesn't match email count ({len(unformated_emails)})")
            # Pad with 'Others' if we have fewer categories
            while len(output) < len(unformated_emails):
                output.append('Others')
            # Truncate if we have more categories
            output = output[:len(unformated_emails)]
        
        print(f"[DEBUG] AI categorization successful: {output}")
        return output
        
    except Exception as e:
        print(f"Error in AI categorization: {str(e)}")
        print("[DEBUG] Falling back to simple categorization")
        # Return fallback categories using simple logic
        return simple_categorize(unformated_emails)
    
    
class CategoryStorage:
    def __init__(self, user_email):
        self.user_email = user_email
        self.storage_dir = "saved_categories"
        self.ensure_storage_dir()
    
    def ensure_storage_dir(self):
        """Ensure the storage directory exists"""
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
    
    def get_user_file_path(self, file_type):
        """Get file path for user's saved data"""
        # Create a hash of the email to use as filename
        email_hash = hashlib.md5(self.user_email.encode()).hexdigest()
        return os.path.join(self.storage_dir, f"{email_hash}_{file_type}.json")
    
    def save_categories(self, categories, query=""):
        """Save categories to local file"""
        try:
            file_path = self.get_user_file_path("categories")
            current_time = datetime.now()
            formatted_time = current_time.strftime("%Y-%m-%d %I:%M %p")
            
            data = {
                "user_email": self.user_email,
                "categories": categories,
                "query": query,
                "saved_at": formatted_time,
                "saved_at_iso": current_time.isoformat(),
                "email_count": sum(len(emails) for emails in categories.values())
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error saving categories: {e}")
            return False
    
    def load_categories(self):
        """Load categories from local file"""
        try:
            file_path = self.get_user_file_path("categories")
            if not os.path.exists(file_path):
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return data
        except Exception as e:
            print(f"Error loading categories: {e}")
            return None
    
    def save_folders(self, folders):
        """Save folder structure to local file"""
        try:
            file_path = self.get_user_file_path("folders")
            current_time = datetime.now()
            formatted_time = current_time.strftime("%Y-%m-%d %I:%M %p")
            
            data = {
                "user_email": self.user_email,
                "folders": folders,
                "saved_at": formatted_time,
                "saved_at_iso": current_time.isoformat()
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error saving folders: {e}")
            return False
    
    def load_folders(self):
        """Load folder structure from local file"""
        try:
            file_path = self.get_user_file_path("folders")
            if not os.path.exists(file_path):
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return data
        except Exception as e:
            print(f"Error loading folders: {e}")
            return None
    
    def has_saved_categories(self):
        """Check if user has saved categories"""
        file_path = self.get_user_file_path("categories")
        return os.path.exists(file_path)
    
    def has_saved_folders(self):
        """Check if user has saved folders"""
        file_path = self.get_user_file_path("folders")
        return os.path.exists(file_path)
    