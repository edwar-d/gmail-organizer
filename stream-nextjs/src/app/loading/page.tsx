'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoadingPage() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  
  const loadingMessages = [
    "Loading your experience...",
    "Connecting to your Gmail",
    "Fetching your emails",
    "Almost ready"
  ];

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    const loadInboxData = async () => {
      try {
        console.log('[DEBUG] Loading page - Making direct request to Flask backend');
        // Make direct request to Flask backend with credentials
        const response = await fetch('http://localhost:5000/api/load-inbox', {
          method: 'GET',
          credentials: 'include', // Include cookies for cross-origin requests
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('[DEBUG] Loading page - Flask response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.log('[DEBUG] Loading page - Flask error:', errorData);
          
          if (errorData.redirect) {
            router.push(errorData.redirect);
            return;
          }
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[DEBUG] Loading page - Success, received data for:', data.user_email);
        
        // Store data in sessionStorage for the inbox page
        sessionStorage.setItem('inboxData', JSON.stringify(data));
        
        // Small delay for better UX
        setTimeout(() => {
          router.push('/inbox');
        }, 1000);
        
      } catch (error) {
        console.error('[DEBUG] Loading page - Error loading inbox:', error);
        // Check if it's an authentication error
        if (error instanceof Error && error.message.includes('Not authenticated')) {
          console.log('[DEBUG] Loading page - Authentication error, redirecting to login');
          router.push('/');
          return;
        }
        // Retry after 3 seconds for other errors
        setTimeout(loadInboxData, 3000);
      }
    };

    // Start loading process
    setTimeout(loadInboxData, 1500);

    return () => {
      clearInterval(messageInterval);
    };
  }, [router]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/60 rounded-full animate-float"
            style={{
              left: `${(i + 1) * 10}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: '6s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear'
            }}
          />
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-[10px] p-16 rounded-[20px] shadow-2xl text-center border border-white/20">
        <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center">
          <div 
            className="absolute inset-0 rounded-full opacity-60 z-[1] animate-water-flow"
            style={{
              background: 'radial-gradient(circle at center, rgba(103, 126, 234, 0.6) 0%, rgba(118, 75, 162, 0.4) 40%, rgba(64, 133, 244, 0.3) 70%, transparent 100%)',
              filter: 'blur(20px)'
            }}
          />
          <div className="relative w-full h-full rounded-full z-[2] bg-[#4285f4] flex items-center justify-center text-white text-6xl shadow-lg">
            <i className="fas fa-tint"></i>
          </div>
        </div>
        
        <h1 className="text-white mb-4 text-4xl font-light tracking-[2px] drop-shadow-lg">
          Stream
        </h1>
        <p className="text-white/90 mb-8 text-lg font-light transition-opacity duration-300">
          {loadingMessages[messageIndex]}
          <span className="inline-block animate-loading-dots">...</span>
        </p>
        
        <div className="w-48 h-1 bg-white/20 rounded-sm mx-auto overflow-hidden relative">
          <div 
            className="h-full rounded-sm animate-progress-flow"
            style={{
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0.4) 100%)'
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(90vh) scale(1);
          }
          90% {
            opacity: 1;
            transform: translateY(-10vh) scale(1);
          }
          100% {
            transform: translateY(-20vh) scale(0);
            opacity: 0;
          }
        }

        @keyframes water-flow {
          0% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 0.6;
          }
          25% {
            transform: translate(-48%, -52%) scale(1.1) rotate(90deg);
            opacity: 0.8;
          }
          50% {
            transform: translate(-52%, -50%) scale(1.05) rotate(180deg);
            opacity: 0.7;
          }
          75% {
            transform: translate(-50%, -48%) scale(1.15) rotate(270deg);
            opacity: 0.9;
          }
          100% {
            transform: translate(-50%, -50%) scale(1) rotate(360deg);
            opacity: 0.6;
          }
        }

        @keyframes loading-dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        @keyframes progress-flow {
          0% {
            width: 0%;
            transform: translateX(-100%);
          }
          50% {
            width: 70%;
            transform: translateX(0%);
          }
          100% {
            width: 100%;
            transform: translateX(20%);
          }
        }

        .animate-float {
          animation: float 6s linear infinite;
        }

        .animate-water-flow {
          animation: water-flow 4s ease-in-out infinite;
        }

        .animate-loading-dots::after {
          content: '';
          animation: loading-dots 1.5s infinite;
        }

        .animate-progress-flow {
          animation: progress-flow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
} 