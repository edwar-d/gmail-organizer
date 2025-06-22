import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params;

    // Forward the request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/categorize_status/${sessionId}`, {
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
    console.error('Error checking categorization status:', error);
    return NextResponse.json(
      { 
        status: 'error',
        progress: 0,
        message: 'Failed to check categorization status'
      },
      { status: 500 }
    );
  }
} 