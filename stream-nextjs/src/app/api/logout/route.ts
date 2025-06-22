import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    // Forward the logout request to Flask backend
    const response = await fetch(`${FLASK_API_URL}/logout`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
      redirect: 'manual', // Don't follow redirects automatically
    });

    // Flask will redirect to Next.js homepage, but we'll handle it here
    return NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully',
      redirect: '/' 
    });

  } catch (error) {
    console.error('Error logging out via Flask:', error);
    return NextResponse.json(
      { error: 'Failed to logout via backend' },
      { status: 500 }
    );
  }
} 