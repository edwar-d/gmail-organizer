'use client';

import Link from "next/link";
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status with Flask backend
    const checkAuth = async () => {
      try {
        console.log('[DEBUG] Main page - Checking authentication with Flask backend');
        const response = await fetch('http://localhost:5000/', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        console.log('[DEBUG] Main page - Auth check response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[DEBUG] Main page - Auth check response:', data);
          
          if (data.authenticated) {
            console.log('[DEBUG] Main page - User is authenticated, redirecting to loading');
            // User is authenticated, redirect to loading page
            window.location.href = '/loading';
            return;
          }
        }
        
        console.log('[DEBUG] Main page - User is not authenticated, showing login page');
        // User is not authenticated, show the login page
        setIsLoading(false);
      } catch (error) {
        console.error('[DEBUG] Main page - Error checking authentication:', error);
        // If Flask backend is not available, show login page
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div className="bg-white p-10 rounded-xl shadow-2xl text-center max-w-md w-[90%] pt-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285f4] mx-auto mb-4"></div>
          <p className="text-[#605e5c]">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="bg-white p-10 rounded-xl shadow-2xl text-center max-w-md w-[90%] pt-16">
        <div className="relative w-24 h-24 mx-auto mb-5">
          <div 
            className="absolute inset-0 rounded-[20px] opacity-70 z-[1]"
            style={{
              filter: 'blur(30px) saturate(2)',
              backgroundImage: 'url(/static/imgs/hdsrt9qtu7vqu8mwzyr8.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div 
            className="absolute inset-0 rounded-[20px] z-[2]"
            style={{
              backgroundImage: 'url(/static/imgs/hdsrt9qtu7vqu8mwzyr8.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        </div>
        
        <h1 className="text-[#323130] mb-3 text-3xl font-semibold">Stream</h1>
        <p className="text-[#605e5c] mb-8 text-base">
          Organize less, flow more. AI that anticipates, so you don&apos;t have to organize
        </p>
        
        <Link 
          href="/login" 
          className="inline-flex items-center gap-3 bg-[#4285f4] text-white px-6 py-3 border-none rounded-md text-base font-medium no-underline transition-all duration-300 cursor-pointer hover:bg-[#3367d6] hover:-translate-y-0.5 hover:shadow-lg"
          style={{ boxShadow: '0 4px 12px rgba(66,133,244,0.3)' }}
        >
          <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center text-[#4285f4]">
            <i className="fab fa-google"></i>
          </div>
          Sign in with Google
        </Link>

        <div className="mt-10 text-left">
          <h3 className="text-[#323130] mb-4 text-lg">Features</h3>
          <div className="flex items-center gap-2.5 mb-2.5 text-[#605e5c] text-sm">
            <i className="fas fa-check text-[#0078d4] w-4"></i>
            <span>Clean, familiar user interface</span>
          </div>
          <div className="flex items-center gap-2.5 mb-2.5 text-[#605e5c] text-sm">
            <i className="fas fa-check text-[#0078d4] w-4"></i>
            <span>Search That Reads Your Mind</span>
          </div>
          <div className="flex items-center gap-2.5 mb-2.5 text-[#605e5c] text-sm">
            <i className="fas fa-check text-[#0078d4] w-4"></i>
            <span>Smart Categories, Zero Effort</span>
          </div>
          <div className="flex items-center gap-2.5 mb-2.5 text-[#605e5c] text-sm">
            <i className="fas fa-check text-[#0078d4] w-4"></i>
            <span>Responsive design for all devices</span>
          </div>
        </div>
      </div>
    </div>
  );
}
