import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Forward the request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/api/email/${id}/mark-read`, {
      method: 'POST',
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
    console.error('Error marking email as read via Flask:', error);
    return NextResponse.json(
      { error: 'Failed to mark email as read via backend' },
      { status: 500 }
    );
  }
} 