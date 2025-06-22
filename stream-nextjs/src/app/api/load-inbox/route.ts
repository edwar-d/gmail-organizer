import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG] Next.js /api/load-inbox - Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[DEBUG] Next.js /api/load-inbox - Request cookies:', request.headers.get('cookie'));
    
    // Forward the request to Flask backend with all cookies
    const response = await fetch(`${FLASK_API_URL}/api/load-inbox`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
        'User-Agent': request.headers.get('user-agent') || '',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    console.log('[DEBUG] Next.js /api/load-inbox - Flask response status:', response.status);
    console.log('[DEBUG] Next.js /api/load-inbox - Flask response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[DEBUG] Next.js /api/load-inbox - Flask error response:', errorText);
      
      // Try to parse as JSON, fallback to text
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log('[DEBUG] Next.js /api/load-inbox - Success, data keys:', Object.keys(data));
    
    // Forward any Set-Cookie headers from Flask
    const nextResponse = NextResponse.json(data);
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    
    return nextResponse;

  } catch (error) {
    console.error('[DEBUG] Next.js /api/load-inbox - Error:', error);
    return NextResponse.json(
      { error: 'Failed to load inbox from backend', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 