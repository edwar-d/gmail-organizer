# Stream - AI-Powered Email Organization Platform

A modern email management system that uses AI to automatically categorize your emails with a beautiful Next.js frontend and Flask backend.

## Architecture

- **Flask Backend** (Port 5000): Handles Gmail API, OAuth authentication, and AI categorization
- **Next.js Frontend** (Port 3000): Modern React-based UI with server-side rendering

## Prerequisites

- Python 3.8+ 
- Node.js 16+
- Gmail API credentials (credentials.json)

## Setup Instructions

### 1. Flask Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Ensure you have credentials.json in the root directory
# (Download from Google Cloud Console with Gmail API enabled)
```

### 2. Next.js Frontend Setup

```bash
# Navigate to the Next.js directory
cd stream-nextjs

# Install Node.js dependencies
npm install

# Return to root directory
cd ..
```

## Starting the Application

### Method 1: Manual Start (Recommended for Development)

**Terminal 1 - Start Flask Backend:**
```bash
python app.py
```
This starts the Flask server on http://localhost:5000

**Terminal 2 - Start Next.js Frontend:**
```bash
cd stream-nextjs
npm run dev
```
This starts the Next.js server on http://localhost:3000

### Method 2: Quick Test

You can test if everything is working by:

1. Start Flask backend: `python app.py`
2. Test health endpoint: Visit http://localhost:5000/api/health
3. Start Next.js frontend: `cd stream-nextjs && npm run dev`
4. Visit http://localhost:3000

## Features

- **Gmail Integration**: Secure OAuth2 authentication with Gmail
- **AI Categorization**: Uses Google's Gemini 2.0 Flash for intelligent email categorization
- **Real-time Processing**: Live progress tracking during categorization
- **Modern UI**: Beautiful, responsive interface built with Next.js and Tailwind CSS
- **Email Viewer**: Rich email content display with HTML support, image handling, and link previews
- **Custom Categories**: Support for user-defined categorization queries
- **Fallback System**: Graceful degradation to rule-based categorization if AI fails

## Usage

1. **Login**: Visit http://localhost:3000 and authenticate with Google
2. **View Inbox**: Browse your emails in a modern interface
3. **Categorize**: Click the magic wand icon or visit /categorize
4. **Custom Queries**: Add specific categorization instructions like "by priority" or "by project"
5. **View Results**: Browse categorized emails in an organized grid layout

## API Endpoints

### Flask Backend (Port 5000)
- `GET /` - Authentication check
- `GET /login` - Start OAuth flow
- `GET /api/emails` - Fetch emails
- `GET /api/email/<id>` - Get specific email
- `POST /categorize` - Start categorization
- `GET /categorize_status/<session_id>` - Check categorization progress
- `GET /categorize_results/<session_id>` - Get categorization results

### Next.js Frontend (Port 3000)
- All routes proxy to Flask backend for API calls
- Modern React pages for UI

## Troubleshooting

### Flask Won't Start
- Check if Python dependencies are installed: `pip install -r requirements.txt`
- Verify credentials.json is in the root directory
- Test import: `python -c "import app; print('OK')"`

### Next.js Won't Start
- Check if Node.js dependencies are installed: `cd stream-nextjs && npm install`
- Verify Node.js version: `node --version` (should be 16+)

### Categorization Fails
- Ensure Flask backend is running on port 5000
- Check if Gemini API key is valid in utils.py
- System will fallback to rule-based categorization if AI fails

### Authentication Issues
- Verify credentials.json has correct redirect URIs
- Check that Gmail API is enabled in Google Cloud Console
- Clear browser cookies and try again

## Development Notes

- The system is designed to be fault-tolerant with multiple fallback mechanisms
- AI categorization uses Google's Gemini 2.0 Flash model
- Session management handles concurrent categorization requests
- The frontend gracefully handles backend failures with mock data

## File Structure

```
Stream/
├── app.py                 # Flask backend main file
├── utils.py              # Email processing and AI categorization
├── requirements.txt      # Python dependencies
├── credentials.json      # Google OAuth credentials (not in repo)
├── templates/           # Flask HTML templates (legacy)
├── static/             # Static assets and CSS
└── stream-nextjs/      # Next.js frontend
    ├── src/app/        # Next.js app router pages
    ├── src/components/ # React components
    └── src/lib/        # Utility libraries
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
