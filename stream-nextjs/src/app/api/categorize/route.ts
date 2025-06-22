import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

// Mock categorized email data
const generateMockCategories = (query?: string) => {
  const baseCategories = {
    'Work': [
      {
        id: '1',
        sender: 'john.doe@company.com',
        sender_name: 'John Doe',
        subject: 'Weekly Project Update',
        date: new Date().toISOString(),
        snippet: 'Here\'s the weekly update on our project progress.',
        content: 'Hi team, I wanted to provide you with a comprehensive update on our project progress this week.'
      },
      {
        id: '6',
        sender: 'manager@company.com',
        sender_name: 'Project Manager',
        subject: 'Budget Review Meeting',
        date: new Date(Date.now() - 7200000).toISOString(),
        snippet: 'We need to schedule a budget review meeting for next week.',
        content: 'Please review the budget documents before our meeting next Tuesday.'
      }
    ],
    'Personal': [
      {
        id: '2',
        sender: 'sarah.wilson@personal.com',
        sender_name: 'Sarah Wilson',
        subject: 'Weekend Plans',
        date: new Date(Date.now() - 3600000).toISOString(),
        snippet: 'Are you free this weekend for dinner?',
        content: 'Hey! I was wondering if you\'d like to grab dinner this weekend.'
      }
    ],
    'Newsletters': [
      {
        id: '3',
        sender: 'newsletter@techblog.com',
        sender_name: 'Tech Blog Newsletter',
        subject: 'Latest Tech Trends - Weekly Digest',
        date: new Date(Date.now() - 86400000).toISOString(),
        snippet: 'This week in tech: AI breakthroughs, new frameworks.',
        content: 'Welcome to this week\'s Tech Blog Newsletter with the latest updates.'
      }
    ],
    'Support': [
      {
        id: '4',
        sender: 'support@streamapp.com',
        sender_name: 'Stream Support',
        subject: 'Welcome to Stream - Getting Started Guide',
        date: new Date(Date.now() - 172800000).toISOString(),
        snippet: 'Welcome to Stream! Here\'s everything you need to know.',
        content: 'Thank you for joining Stream, the AI-powered email organization platform.'
      }
    ],
    'Security': [
      {
        id: '5',
        sender: 'alerts@bankingsystem.com',
        sender_name: 'Banking System',
        subject: 'Security Alert: New Login Detected',
        date: new Date(Date.now() - 259200000).toISOString(),
        snippet: 'We detected a new login to your account from a new device.',
        content: 'Security Alert - We detected a new login to your account.'
      }
    ]
  };

  // If there's a custom query, modify categories based on it
  if (query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('priority') || queryLower.includes('urgent')) {
      return {
        'High Priority': [
          baseCategories.Work[0],
          baseCategories.Security[0]
        ],
        'Medium Priority': [
          baseCategories.Work[1],
          baseCategories.Personal[0]
        ],
        'Low Priority': [
          baseCategories.Newsletters[0],
          baseCategories.Support[0]
        ]
      };
    }
    
    if (queryLower.includes('project')) {
      return {
        'Project Communications': [
          baseCategories.Work[0],
          baseCategories.Work[1]
        ],
        'Non-Project': [
          ...baseCategories.Personal,
          ...baseCategories.Newsletters,
          ...baseCategories.Support,
          ...baseCategories.Security
        ]
      };
    }
  }

  return baseCategories;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';

    // Forward the request to Flask backend
    const flaskUrl = new URL('/categorize', FLASK_API_URL);
    if (query) {
      flaskUrl.searchParams.set('query', query);
    }

    const response = await fetch(flaskUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Authentication required', redirect: '/login' },
          { status: 401 }
        );
      }
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Flask now returns session info, redirect to loading page
    if (data.session_id) {
      return NextResponse.json({
        redirect: `/categorize/loading?session_id=${data.session_id}&user_email=${encodeURIComponent(data.user_email)}&total_emails=${data.total_emails}`,
        session_id: data.session_id,
        user_email: data.user_email,
        total_emails: data.total_emails
      });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error starting categorization via Flask:', error);
    return NextResponse.json(
      { error: 'Failed to start categorization via backend' },
      { status: 500 }
    );
  }
}

// Keep the POST method for backward compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    // Forward to GET method for consistency
    const url = new URL(request.url);
    if (query) {
      url.searchParams.set('query', query);
    }
    
    return GET(new NextRequest(url, { method: 'GET' }));

  } catch (error) {
    console.error('Error processing categorization:', error);
    return NextResponse.json(
      { error: 'Failed to process categorization' },
      { status: 500 }
    );
  }
} 