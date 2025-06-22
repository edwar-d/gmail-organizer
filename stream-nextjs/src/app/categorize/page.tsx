'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export default function CategorizePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryData>({});
  const [userEmail, setUserEmail] = useState('user@example.com');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sessionIdParam = searchParams.get('session_id');
    if (sessionIdParam) {
      // We're coming from the loading page with results
      setSessionId(sessionIdParam);
      loadCategorizedResults(sessionIdParam);
    } else {
      // Start new categorization or load existing categories
      loadCategories();
    }
  }, []);

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
      // Fallback to regular categorization
      loadCategories();
    }
  };

  const loadCategories = async () => {
    try {
      const queryParam = searchParams.get('query');
      const url = queryParam ? `/api/categorize?query=${encodeURIComponent(queryParam)}` : '/api/categorize';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        throw new Error(data.error);
      }
      
      // Check if we got a redirect to loading page
      if (data.redirect) {
        router.push(data.redirect);
        return;
      }
      
      // If we got categories directly (fallback), display them
      if (data.categories) {
        setCategories(data.categories);
        setUserEmail(data.user_email || 'user@example.com');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // For demo purposes, use mock data
      setCategories({
        'Work': [
          {
            id: '1',
            sender: 'boss@company.com',
            sender_name: 'Boss',
            subject: 'Project Update Required',
            date: new Date().toISOString(),
            snippet: 'Please provide an update on the current project status.',
            content: 'Hi there, I need an update on the project we discussed last week.'
          }
        ],
        'Personal': [
          {
            id: '2',
            sender: 'friend@example.com',
            sender_name: 'Friend',
            subject: 'Weekend Plans',
            date: new Date(Date.now() - 86400000).toISOString(),
            snippet: 'Are you free this weekend for a coffee?',
            content: 'Hey! I was wondering if you\'d like to grab coffee this weekend.'
          }
        ],
        'Newsletters': [
          {
            id: '3',
            sender: 'newsletter@tech.com',
            sender_name: 'Tech Newsletter',
            subject: 'Weekly Tech Updates',
            date: new Date(Date.now() - 172800000).toISOString(),
            snippet: 'This week in technology: AI advances, new frameworks, and more.',
            content: 'Welcome to this week\'s tech newsletter with the latest updates.'
          }
        ]
      });
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/categorize?query=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/categorize');
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !showModal) {
      e.preventDefault();
      document.getElementById('categoryQuery')?.focus();
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
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  const categoryColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] p-4 flex justify-between items-center sticky top-0 z-[100]">
        <h1 className="text-[#1e293b] text-2xl font-semibold flex items-center gap-2">
          <i className="fas fa-inbox text-[#3b82f6]"></i>
          Email Categories
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-[#64748b] text-sm font-medium">{userEmail}</span>
          <Link 
            href="/inbox" 
            className="bg-white text-[#64748b] no-underline px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 border border-[#e2e8f0] text-sm font-medium hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
          >
            <i className="fas fa-arrow-left"></i> Back
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
          <h2 className="text-[#1e293b] text-3xl font-bold mb-2">Your Streamlined Inbox</h2>
          <p className="text-[#64748b] text-base mb-6">Emails automatically sorted into categories for better organization</p>
          
          <div className="max-w-2xl">
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative flex items-center bg-white border-2 border-[#e2e8f0] rounded-xl overflow-hidden transition-all duration-200 focus-within:border-[#3b82f6] focus-within:shadow-[0_0_0_3px_rgb(59_130_246_/_0.1)]">
                <i className="fas fa-magic text-[#94a3b8] text-base ml-4"></i>
                <input
                  type="text"
                  id="categoryQuery"
                  name="query"
                  placeholder="Describe how you'd like your emails categorized (e.g., 'by priority', 'by project', 'urgent vs non-urgent')"
                  className="flex-1 border-none p-4 text-sm text-[#1e293b] bg-transparent outline-none placeholder:text-[#94a3b8]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button 
                  type="submit" 
                  className="bg-[#3b82f6] text-white border-none p-4 cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-[#2563eb]"
                >
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </form>
            {query && (
              <div className="flex items-center gap-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-3 text-sm text-[#1e40af]">
                <i className="fas fa-filter text-[#3b82f6]"></i>
                <span>Categorized by: "{query}"</span>
                <Link href="/categorize" className="ml-auto text-[#64748b] no-underline p-1 rounded transition-all duration-200 hover:bg-[#cbd5e1] hover:text-[#374151]">
                  <i className="fas fa-times"></i>
                </Link>
              </div>
            )}
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