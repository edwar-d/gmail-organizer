'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CategorizeLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Analyzing emails...');
  const [error, setError] = useState<string | null>(null);
  
  const sessionId = searchParams.get('session_id') || 'demo-session';
  const userEmail = searchParams.get('user_email') || 'user@example.com';
  const totalEmails = searchParams.get('total_emails') || '50';

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/categorize-status/${sessionId}`);
        const data = await response.json();
        
        if (data.status === 'completed' || data.status === 'complete') {
          setProgress(100);
          setMessage('Complete! Redirecting...');
          clearInterval(checkInterval);
          
          // Redirect to results page with session_id
          setTimeout(() => {
            router.push(`/categorize/results/${sessionId}`);
          }, 1000);
          
        } else if (data.status === 'error') {
          setError(data.message || 'An error occurred during categorization');
          clearInterval(checkInterval);
          
        } else if (data.status === 'index_error') {
          // Handle index error but still proceed
          setProgress(100);
          setMessage('Complete! Redirecting...');
          clearInterval(checkInterval);
          
          setTimeout(() => {
            router.push(`/categorize/results/${sessionId}`);
          }, 1000);
          
        } else {
          // Update progress
          setProgress(data.progress || 0);
          setMessage(data.message || 'Processing...');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setError('Connection error. Please try again.');
        clearInterval(checkInterval);
      }
    };

    // Start checking status every 2 seconds
    checkInterval = setInterval(checkStatus, 2000);
    
    // Check status immediately
    checkStatus();

    return () => {
      clearInterval(checkInterval);
    };
  }, [sessionId, router]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setMessage('Analyzing emails...');
    
    // Redirect back to categorize to start over
    router.push('/categorize');
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center text-white"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="text-center bg-white/10 backdrop-blur-[10px] rounded-[20px] p-12 shadow-2xl border border-white/20 max-w-lg w-[90%]">
        {!error && (
          <div className="w-20 h-20 mx-auto mb-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        )}
        
        <h1 className="text-2xl font-semibold mb-4 opacity-90">
          {error ? 'Categorization Error' : 'Categorizing Your Emails'}
        </h1>
        
        {!error && (
          <p className="text-lg mb-8 opacity-80">
            {message}
            <span className="inline-block animate-pulse">...</span>
          </p>
        )}
        
        {!error && (
          <>
            <div className="bg-white/20 rounded-[10px] h-2 mb-4 overflow-hidden">
              <div 
                className="h-full rounded-[10px] transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)'
                }}
              />
            </div>
            <div className="text-sm opacity-70 mb-8">{Math.round(progress)}%</div>
          </>
        )}
        
        <div className="bg-white/10 rounded-[10px] p-4 border border-white/10 mb-4">
          <p className="mb-2 text-sm opacity-80">
            <strong>Account:</strong> {decodeURIComponent(userEmail)}
          </p>
          <p className="text-sm opacity-80">
            <strong>Emails to process:</strong> {totalEmails}
          </p>
        </div>
        
        {error && (
          <div className="mt-4">
            <div className="text-[#ff6b6b] bg-red-500/10 border border-red-500/30 rounded-[10px] p-4 mb-4">
              {error}
            </div>
            <button 
              className="bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white border-none px-8 py-3 rounded-[10px] text-base cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
              onClick={handleRetry}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        .animate-pulse::after {
          content: '';
          animation: pulse 1.5s steps(4, end) infinite;
        }
      `}</style>
    </div>
  );
} 