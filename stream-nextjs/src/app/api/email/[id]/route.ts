import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

// Mock email data (same as in emails route)
const mockEmails = [
  {
    id: '1',
    sender: 'john.doe@company.com',
    sender_name: 'John Doe',
    subject: 'Weekly Project Update',
    date: new Date().toISOString(),
    snippet: 'Here\'s the weekly update on our project progress. We\'ve completed the initial phase and are moving forward with the next steps.',
    body: 'Hi team,\n\nI wanted to provide you with a comprehensive update on our project progress this week.\n\nCompleted:\n- Initial research phase\n- Requirements gathering\n- Technical specifications\n\nNext Steps:\n- Begin development phase\n- Set up testing environment\n- Schedule client review\n\nPlease let me know if you have any questions.\n\nBest regards,\nJohn',
    html_body: '<p>Hi team,</p><p>I wanted to provide you with a comprehensive update on our project progress this week.</p><h3>Completed:</h3><ul><li>Initial research phase</li><li>Requirements gathering</li><li>Technical specifications</li></ul><h3>Next Steps:</h3><ul><li>Begin development phase</li><li>Set up testing environment</li><li>Schedule client review</li></ul><p>Please let me know if you have any questions.</p><p>Best regards,<br>John</p>',
    is_unread: true,
    has_attachments: false,
    to: 'team@company.com',
    recipient: 'team@company.com'
  },
  {
    id: '2',
    sender: 'sarah.wilson@client.com',
    sender_name: 'Sarah Wilson',
    subject: 'Meeting Reschedule Request',
    date: new Date(Date.now() - 3600000).toISOString(),
    snippet: 'I need to reschedule our meeting scheduled for tomorrow. Would Thursday at 2 PM work for you instead?',
    body: 'Hi,\n\nI hope this email finds you well. Unfortunately, I need to reschedule our meeting that was planned for tomorrow at 10 AM.\n\nWould Thursday at 2 PM work for you instead? I apologize for any inconvenience this may cause.\n\nPlease let me know if this new time works for your schedule.\n\nThank you for your understanding.\n\nBest regards,\nSarah Wilson',
    is_unread: true,
    has_attachments: false,
    to: 'user@example.com',
    recipient: 'user@example.com'
  },
  {
    id: '3',
    sender: 'newsletter@techblog.com',
    sender_name: 'Tech Blog Newsletter',
    subject: 'Latest Tech Trends - Weekly Digest',
    date: new Date(Date.now() - 86400000).toISOString(),
    snippet: 'This week in tech: AI breakthroughs, new JavaScript frameworks, and the latest in cloud computing innovations.',
    body: 'Welcome to this week\'s Tech Blog Newsletter!\n\nFeatured Articles:\n1. AI Breakthroughs in 2024\n2. New JavaScript Frameworks to Watch\n3. Cloud Computing Innovations\n4. Cybersecurity Best Practices\n\nRead more at techblog.com\n\nUnsubscribe | Manage Preferences',
    is_unread: false,
    has_attachments: false,
    to: 'subscribers@techblog.com',
    recipient: 'subscribers@techblog.com'
  },
  {
    id: '4',
    sender: 'support@streamapp.com',
    sender_name: 'Stream Support',
    subject: 'Welcome to Stream - Getting Started Guide',
    date: new Date(Date.now() - 172800000).toISOString(),
    snippet: 'Welcome to Stream! Here\'s everything you need to know to get started with AI-powered email organization.',
    body: 'Welcome to Stream!\n\nThank you for joining Stream, the AI-powered email organization platform.\n\nGetting Started:\n1. Connect your Gmail account\n2. Let our AI categorize your emails\n3. Use smart search to find anything instantly\n4. Enjoy a clutter-free inbox\n\nNeed help? Contact our support team anytime.\n\nHappy organizing!\nThe Stream Team',
    is_unread: false,
    has_attachments: true,
    attachments: [
      {
        filename: 'getting-started-guide.pdf',
        size: 2048000,
        mimeType: 'application/pdf'
      }
    ],
    to: 'user@example.com',
    recipient: 'user@example.com'
  },
  {
    id: '5',
    sender: 'alerts@bankingsystem.com',
    sender_name: 'Banking System',
    subject: 'Security Alert: New Login Detected',
    date: new Date(Date.now() - 259200000).toISOString(),
    snippet: 'We detected a new login to your account from a new device. If this was you, no action is needed.',
    body: 'Security Alert\n\nWe detected a new login to your account:\n\nDevice: Chrome on Windows\nLocation: New York, NY\nTime: Today at 2:30 PM\n\nIf this was you, no action is needed. If you don\'t recognize this activity, please contact us immediately.\n\nStay secure,\nBanking Security Team',
    is_unread: false,
    has_attachments: false,
    to: 'user@example.com',
    recipient: 'user@example.com'
  }
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Forward the request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/api/email/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching email details from Flask:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email details from backend' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Forward the delete request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/api/email/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error deleting email via Flask:', error);
    return NextResponse.json(
      { error: 'Failed to delete email via backend' },
      { status: 500 }
    );
  }
} 