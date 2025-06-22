'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthorizedPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing authorization...');

  useEffect(() => {
    const handleAuthorization = async () => {
      try {
        // Get the authorization code and state from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Authorization failed: ${error}`);
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization parameters');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
          return;
        }

        setMessage('Exchanging authorization code...');

        // In a real app, you would send the code to your backend to exchange for tokens
        // For demo purposes, we'll simulate successful authorization
        setTimeout(() => {
          setMessage('Authorization successful! Redirecting...');
          
          // Store some mock authentication data
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('authenticated', 'true');
            sessionStorage.setItem('user_email', 'demo@example.com');
          }
          
          // Redirect to loading page
          setTimeout(() => {
            window.location.href = '/loading';
          }, 1000);
        }, 2000);

      } catch (error) {
        console.error('Authorization error:', error);
        setStatus('error');
        setMessage('Authorization failed. Please try again.');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleAuthorization();
  }, [searchParams]);

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
          {message}
        </p>
        
        {status === 'processing' && (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4285f4]"></div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-[#d13438] text-center">
            <i className="fas fa-exclamation-triangle text-3xl mb-4"></i>
            <p className="text-sm">You will be redirected to the login page shortly.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-[#10b981] text-center">
            <i className="fas fa-check-circle text-3xl mb-4"></i>
          </div>
        )}
      </div>
    </div>
  );
} 