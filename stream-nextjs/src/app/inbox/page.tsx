'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmailPopup from '../../components/EmailPopup';
import EmailViewer from '../../components/EmailViewer';

interface Email {
  id: string;
  sender: string;
  sender_name?: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  html_body?: string;
  is_unread: boolean;
  has_attachments: boolean;
  attachments?: Array<{
    filename: string;
    size: number;
    mimeType: string;
  }>;
}

export default function InboxPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [, setSelectedEmailElement] = useState<HTMLElement | null>(null);
  const [currentPopupEmailId, setCurrentPopupEmailId] = useState<string | null>(null);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [userEmail, setUserEmail] = useState('user@example.com');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      console.log('[DEBUG] Inbox - Loading emails from Flask backend');
      const response = await fetch('http://localhost:5000/api/emails', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[DEBUG] Inbox - Flask response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[DEBUG] Inbox - Flask error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Inbox - Success, received', data.emails?.length || 0, 'emails for', data.user_email);
      
      setEmails(data.emails || []);
      setUserEmail(data.user_email || 'user@example.com');
      setLoading(false);
    } catch (error) {
      console.error('Error loading emails:', error);
      // For demo purposes, use mock data
      setEmails([
        {
          id: '1',
          sender: 'john@example.com',
          sender_name: 'John Doe',
          subject: 'Welcome to Stream',
          date: new Date().toISOString(),
          snippet: 'Thank you for joining Stream! We\'re excited to help you organize your emails.',
          body: 'Welcome to Stream! This is your first email in the system.',
          is_unread: true,
          has_attachments: false
        },
        {
          id: '2',
          sender: 'support@example.com',
          sender_name: 'Support Team',
          subject: 'Getting Started Guide',
          date: new Date(Date.now() - 86400000).toISOString(),
          snippet: 'Here\'s how to get the most out of Stream...',
          body: 'This is a comprehensive guide to using Stream effectively.',
          is_unread: false,
          has_attachments: true
        }
      ]);
      setLoading(false);
    }
  };

  const handleEmailClick = (email: Email, element: HTMLElement) => {
    setCurrentPopupEmailId(email.id);
    setShowEmailPopup(true);
    
    // Mark as read
    if (email.is_unread) {
      markEmailAsRead(email.id);
    }
  };

  const selectEmail = (email: Email, element: HTMLElement) => {
    // Remove previous selection
    document.querySelectorAll('.email-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selection to current item
    element.classList.add('selected');
    setSelectedEmailElement(element);
    setSelectedEmailId(email.id);
    
    // Mark as read if unread
    if (email.is_unread) {
      markEmailAsRead(email.id);
    }
  };

  const markEmailAsRead = async (emailId: string) => {
    try {
      console.log('[DEBUG] Inbox - Marking email as read:', emailId);
      const response = await fetch(`http://localhost:5000/api/email/${emailId}/mark-read`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[DEBUG] Inbox - Mark read error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      console.log('[DEBUG] Inbox - Successfully marked email as read');
      // Update local state
      setEmails(prev => prev.map(email => 
        email.id === emailId ? { ...email, is_unread: false } : email
      ));
    } catch (error) {
      console.error('[DEBUG] Inbox - Error marking email as read:', error);
    }
  };

  const deleteEmail = async (emailId: string) => {
    if (!confirm('Are you sure you want to delete this email?')) return;
    
    try {
      console.log('[DEBUG] Inbox - Deleting email:', emailId);
      const response = await fetch(`http://localhost:5000/api/email/${emailId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[DEBUG] Inbox - Delete error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      console.log('[DEBUG] Inbox - Successfully deleted email');
      // Remove from local state
      setEmails(prev => prev.filter(email => email.id !== emailId));
      
      // Clear selection if deleted email was selected
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setSelectedEmailElement(null);
      }
    } catch (error) {
      console.error('[DEBUG] Inbox - Error deleting email:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the Flask logout endpoint directly
      window.location.href = 'http://localhost:5000/logout';
    } catch (error) {
      console.error('Error logging out:', error);
      // Fallback to redirect to home page
      router.push('/');
    }
  };

  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#f3f2f1] text-[#323130] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0078d4] to-[#106ebe] text-white p-3 flex justify-between items-center shadow-lg z-[100]">
        <h1 className="text-xl font-normal flex items-center gap-3">
          <i className="fas fa-envelope"></i>
          Stream
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-90">{userEmail}</span>
          <button 
            onClick={handleLogout}
            className="bg-white/15 border border-white/30 text-white px-4 py-2 rounded-md text-sm transition-all duration-300 flex items-center gap-2 hover:bg-white/25 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-[#e1dfdd] p-5 shadow-lg">
          <div className="sidebar-item active p-3 cursor-pointer transition-all duration-300 flex items-center gap-3 text-sm relative my-0.5 bg-gradient-to-r from-[#e3f2fd] to-[#bbdefb] border-r-4 border-[#0078d4] text-[#0078d4] font-medium">
            <i className="fas fa-inbox w-4 text-center text-base"></i>
            <span>Inbox</span>
            <div className="ml-auto bg-[#0078d4] text-white rounded-xl px-2 py-0.5 text-xs font-bold min-w-5 text-center">
              {emails.length}
            </div>
          </div>
          <div className="sidebar-item p-3 cursor-pointer transition-all duration-300 flex items-center gap-3 text-sm relative my-0.5 hover:bg-gradient-to-r hover:from-[#f8f9fa] hover:to-[#e9ecef] hover:translate-x-1">
            <i className="fas fa-paper-plane w-4 text-center text-base"></i>
            <span>Sent</span>
          </div>
          <div className="sidebar-item p-3 cursor-pointer transition-all duration-300 flex items-center gap-3 text-sm relative my-0.5 hover:bg-gradient-to-r hover:from-[#f8f9fa] hover:to-[#e9ecef] hover:translate-x-1">
            <i className="fas fa-file-alt w-4 text-center text-base"></i>
            <span>Drafts</span>
          </div>
          <div className="sidebar-item p-3 cursor-pointer transition-all duration-300 flex items-center gap-3 text-sm relative my-0.5 hover:bg-gradient-to-r hover:from-[#f8f9fa] hover:to-[#e9ecef] hover:translate-x-1">
            <i className="fas fa-exclamation-triangle w-4 text-center text-base"></i>
            <span>Spam</span>
          </div>
          <div className="sidebar-item p-3 cursor-pointer transition-all duration-300 flex items-center gap-3 text-sm relative my-0.5 hover:bg-gradient-to-r hover:from-[#f8f9fa] hover:to-[#e9ecef] hover:translate-x-1">
            <i className="fas fa-trash w-4 text-center text-base"></i>
            <span>Trash</span>
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 bg-white border-r border-[#e1dfdd] overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-[#e1dfdd] bg-gradient-to-b from-[#fafafa] to-[#f5f5f5] flex-shrink-0">
            <h2 className="text-2xl font-semibold text-[#323130] mb-2">Inbox</h2>
            <div className="text-[#605e5c] text-sm font-medium">{emails.length} emails</div>
          </div>

          <div className="mx-5 my-4 relative flex-shrink-0">
            <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-[#605e5c] text-base"></i>
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3 border-2 border-[#e1dfdd] rounded-lg text-sm bg-white transition-all duration-300 focus:outline-none focus:border-[#0078d4] focus:shadow-[0_0_0_3px_rgba(0,120,212,0.1)]"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 px-5 py-3 border-b border-[#e1dfdd] bg-[#fafafa] flex-shrink-0">
            <button 
              className="bg-white border border-[#e1dfdd] px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-[#605e5c] hover:bg-[#f3f2f1] hover:border-[#c8c6c4] hover:-translate-y-0.5"
              onClick={() => window.location.reload()}
              title="Refresh"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <button 
              className="bg-white border border-[#e1dfdd] px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-[#605e5c] hover:bg-[#f3f2f1] hover:border-[#c8c6c4] hover:-translate-y-0.5"
              title="Mark as read"
            >
              <i className="fas fa-envelope-open"></i>
            </button>
            <button 
              className="bg-white border border-[#e1dfdd] px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-[#605e5c] hover:bg-[#f3f2f1] hover:border-[#c8c6c4] hover:-translate-y-0.5"
              title="Delete"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredEmails.map((email, index) => (
              <div
                key={email.id}
                className={`email-item p-4 border-b border-[#f8f9fa] cursor-pointer transition-all duration-300 relative ${
                  email.is_unread ? 'unread bg-white font-medium border-l-4 border-l-[#ff6b35]' : ''
                } hover:bg-gradient-to-r hover:from-[#f8f9fa] hover:to-[#e9ecef] hover:translate-x-1 hover:shadow-md`}
                style={{
                  animation: `slideUp 0.3s ease-out both`,
                  animationDelay: `${index % 2 === 0 ? '0.05s' : '0.1s'}`
                }}
                onClick={(e) => handleEmailClick(email, e.currentTarget as HTMLElement)}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#323130]">
                    {email.is_unread && (
                      <span className="w-2 h-2 bg-[#ff6b35] rounded-full animate-pulse"></span>
                    )}
                    <span className="flex-1">{email.sender_name || email.sender}</span>
                  </div>
                  <div className="text-xs text-[#8a8886] font-medium">
                    {new Date(email.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm text-[#323130] mb-1.5 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {email.subject}
                </div>
                <div className="text-xs text-[#605e5c] mb-2 overflow-hidden text-ellipsis line-clamp-2 leading-relaxed">
                  {email.snippet}
                </div>
                <div className="flex justify-end">
                  {email.has_attachments && (
                    <i className="fas fa-paperclip text-[#8a8886] text-xs"></i>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Viewer */}
        <EmailViewer 
          selectedEmailId={selectedEmailId}
          onReply={() => console.log('Reply')}
          onReplyAll={() => console.log('Reply All')}
          onForward={() => console.log('Forward')}
          onDelete={() => selectedEmailId && deleteEmail(selectedEmailId)}
        />
      </div>

      {/* Magic Wand Button */}
      <div className="fixed bottom-8 left-8 z-[1000]">
        <button
          onClick={() => router.push('/categorize')}
          className="w-15 h-15 rounded-full border-none text-white text-2xl cursor-pointer shadow-lg transition-all duration-300 relative overflow-hidden animate-gradient-shift animate-float"
          style={{
            background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57)',
            backgroundSize: '300% 300%',
            animation: 'gradientShift 3s ease infinite, float 3s ease-in-out infinite'
          }}
          title="Categorize Emails with AI Magic"
        >
          <i className="fas fa-magic relative z-[2] drop-shadow-lg"></i>
          <span className="absolute -top-1 -right-1 text-base animate-sparkle">✨</span>
        </button>
      </div>

      {/* Email Popup */}
      {showEmailPopup && currentPopupEmailId && (
        <EmailPopup
          emailId={currentPopupEmailId}
          onClose={() => {
            setShowEmailPopup(false);
            setCurrentPopupEmailId(null);
          }}
          onReply={() => console.log('Reply from popup')}
          onReplyAll={() => console.log('Reply All from popup')}
          onForward={() => console.log('Forward from popup')}
          onDelete={() => {
            if (currentPopupEmailId) {
              deleteEmail(currentPopupEmailId);
              setShowEmailPopup(false);
              setCurrentPopupEmailId(null);
            }
          }}
        />
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes sparkle {
          0%, 100% { 
            opacity: 0; 
            transform: scale(0.5) rotate(0deg);
          }
          50% { 
            opacity: 1; 
            transform: scale(1) rotate(180deg);
          }
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
} 