'use client';

import { useEffect } from 'react';

export default function LogoutPage() {
  useEffect(() => {
    // Clear any stored authentication data
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      
      // In a real app, you would also clear cookies and revoke tokens
      // For demo purposes, just redirect to home
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  }, []);

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      <div className="bg-white p-10 rounded-xl shadow-2xl text-center max-w-md w-[90%]">
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
          Signing you out...
        </p>
        
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4285f4]"></div>
        </div>
        
        <p className="text-[#605e5c] text-sm mt-4">
          You will be redirected to the login page shortly.
        </p>
      </div>
    </div>
  );
} 