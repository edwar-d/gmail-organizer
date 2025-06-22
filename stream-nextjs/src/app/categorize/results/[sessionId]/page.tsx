'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Email {
  id: string;
  sender: string;
  sender_name?: string;
  subject: string;
  date: string;
  snippet: string;
  content?: string;
  html_body?: string;
  body?: string;
}

interface CategoryData {
  [categoryName: string]: Email[];
}

export default function CategorizeResultsPage() {
  const router = useRouter();
  const params = useParams();
  
  const [categories, setCategories] = useState<CategoryData>({});
  const [userEmail, setUserEmail] = useState('user@example.com');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    const getSessionId = async () => {
      const sessionId = params.sessionId as string;
      if (sessionId) {
        loadCategorizedResults(sessionId);
      }
    };
    getSessionId();
  }, [params]);

  const loadCategorizedResults = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/categorize-results/${sessionId}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setCategories(data.categories || {});
      setUserEmail(data.user_email || 'user@example.com');
      setLoading(false);
    } catch (error) {
      console.error('Error loading categorization results:', error);
      setError('Failed to load categorization results. The session may have expired.');
      setLoading(false);
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmail(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showModal) {
        closeModal();
      } else {
        router.push('/inbox');
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown as any);
    return () => document.removeEventListener('keydown', handleKeyDown as any);
  }, [showModal]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading categorization results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Results Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/categorize"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors no-underline"
            >
              Start New Categorization
            </Link>
            <Link 
              href="/inbox"
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors no-underline"
            >
              Back to Inbox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'];
  const totalEmails = Object.values(categories).flat().length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] p-4 flex justify-between items-center sticky top-0 z-[100]">
        <h1 className="text-[#1e293b] text-2xl font-semibold flex items-center gap-2">
          <i className="fas fa-inbox text-[#3b82f6]"></i>
          Categorization Results
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-[#64748b] text-sm font-medium">{userEmail}</span>
          <Link 
            href="/categorize" 
            className="bg-white text-[#64748b] no-underline px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 border border-[#e2e8f0] text-sm font-medium hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
          >
            <i className="fas fa-magic"></i> New Categorization
          </Link>
          <Link 
            href="/inbox" 
            className="bg-white text-[#64748b] no-underline px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 border border-[#e2e8f0] text-sm font-medium hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
          >
            <i className="fas fa-arrow-left"></i> Back to Inbox
          </Link>
          <Link 
            href="/logout" 
            className="bg-[#3b82f6] text-white no-underline px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 border border-[#3b82f6] text-sm font-medium hover:bg-[#2563eb] hover:border-[#2563eb]"
          >
            <i className="fas fa-sign-out-alt"></i> Logout
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-[#1e293b] text-3xl font-bold mb-2">Your Emails Have Been Categorized!</h2>
          <p className="text-[#64748b] text-base mb-4">
            Successfully organized {totalEmails} emails into {Object.keys(categories).length} categories using AI.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <i className="fas fa-check-circle text-green-600 text-xl"></i>
            <div>
              <p className="text-green-800 font-medium">Categorization Complete</p>
              <p className="text-green-600 text-sm">Your emails are now organized and ready to view.</p>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(categories).map(([categoryName, emails], index) => (
            <div key={categoryName} className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#cbd5e1]">
              <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                  ></div>
                  <h3 className="text-[#1e293b] font-semibold text-base">{categoryName}</h3>
                </div>
                <span className="bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-full text-xs font-medium">
                  {emails.length}
                </span>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {emails.length > 0 ? (
                  emails.map((email) => (
                    <div 
                      key={email.id}
                      className="p-4 border-b border-[#f1f5f9] last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-[#f8fafc]"
                      onClick={() => handleEmailClick(email)}
                    >
                      <div className="text-[#1e293b] font-medium text-sm mb-1 line-clamp-1">
                        {email.subject || 'No Subject'}
                      </div>
                      <div className="text-[#64748b] text-xs mb-2">
                        {email.sender_name || email.sender}
                      </div>
                      <div className="text-[#94a3b8] text-xs line-clamp-2">
                        {email.snippet || email.content || 'No preview available'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[#94a3b8]">
                    <i className="fas fa-inbox text-2xl mb-2"></i>
                    <p className="text-sm">No emails in this category</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Modal */}
      {showModal && selectedEmail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#e2e8f0] flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h2 className="text-[#1e293b] text-xl font-semibold mb-2 line-clamp-2">
                  {selectedEmail.subject || 'No Subject'}
                </h2>
                <div className="flex items-center gap-4 text-sm text-[#64748b]">
                  <span className="font-medium">{selectedEmail.sender_name || selectedEmail.sender}</span>
                  <span>{new Date(selectedEmail.date).toLocaleDateString()}</span>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="text-[#64748b] hover:text-[#1e293b] transition-colors p-2 hover:bg-[#f1f5f9] rounded-lg"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div 
                className="prose max-w-none text-[#374151] leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: selectedEmail.html_body || 
                         selectedEmail.content?.replace(/\n/g, '<br>') || 
                         selectedEmail.body?.replace(/\n/g, '<br>') || 
                         selectedEmail.snippet?.replace(/\n/g, '<br>') || 
                         'No content available'
                }}
              />
            </div>
            
            <div className="p-6 border-t border-[#e2e8f0] flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                Close
              </button>
              <Link 
                href="/inbox"
                className="bg-[#3b82f6] text-white px-4 py-2 rounded-lg hover:bg-[#2563eb] transition-colors no-underline"
              >
                View in Inbox
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 