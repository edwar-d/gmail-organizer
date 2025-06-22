'use client';

import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    // Redirect to Flask backend for Google OAuth
    const handleLogin = () => {
      window.location.href = 'http://localhost:5000/login';
    };

    // Auto-redirect after a short delay to show the loading state
    const timer = setTimeout(handleLogin, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleManualLogin = () => {
    window.location.href = 'http://localhost:5000/login';
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
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
        
        <button
          onClick={handleManualLogin}
          className="inline-flex items-center gap-3 bg-[#4285f4] text-white px-6 py-3 border-none rounded-md text-base font-medium cursor-pointer transition-all duration-300 hover:bg-[#3367d6] hover:-translate-y-0.5 hover:shadow-lg"
          style={{ boxShadow: '0 4px 12px rgba(66,133,244,0.3)' }}
        >
          <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center text-[#4285f4]">
            <i className="fab fa-google"></i>
          </div>
          <span>Connecting to Google...</span>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </button>

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