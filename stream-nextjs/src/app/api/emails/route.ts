import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = searchParams.get('max_results') || '50';
    const query = searchParams.get('q') || '';

    // Forward the request to Flask backend
    const flaskUrl = new URL('/api/emails', FLASK_API_URL);
    flaskUrl.searchParams.set('max_results', maxResults);
    if (query) {
      flaskUrl.searchParams.set('q', query);
    }

    const response = await fetch(flaskUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for session management
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
    console.error('Error fetching emails from Flask:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails from backend' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward the request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Flask API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error processing email operation:', error);
    return NextResponse.json(
      { error: 'Failed to process email operation' },
      { status: 500 }
    );
  }
} 