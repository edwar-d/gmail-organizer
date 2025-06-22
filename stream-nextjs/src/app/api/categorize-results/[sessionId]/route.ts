import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params;

    // Forward the request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/categorize_results/${sessionId}`, {
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
    console.error('Error getting categorization results:', error);
    return NextResponse.json(
      { error: 'Failed to get categorization results' },
      { status: 500 }
    );
  }
} 