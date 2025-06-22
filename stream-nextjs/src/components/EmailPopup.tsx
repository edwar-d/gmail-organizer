'use client';

import { useState, useEffect } from 'react';

interface EmailPopupProps {
  emailId: string;
  onClose: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onDelete: () => void;
}

interface EmailData {
  id: string;
  sender: string;
  sender_name?: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  html_body?: string;
  to?: string;
  recipient?: string;
  attachments?: Array<{
    filename: string;
    size: number;
    mimeType: string;
  }>;
}

export default function EmailPopup({ emailId, onClose, onReply, onReplyAll, onForward, onDelete }: EmailPopupProps) {
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmailData();
  }, [emailId]);

  const loadEmailData = async () => {
    try {
      setLoading(true);
      console.log('[DEBUG] EmailPopup - Loading email data for:', emailId);
      const response = await fetch(`http://localhost:5000/api/email/${emailId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[DEBUG] EmailPopup - Flask response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[DEBUG] EmailPopup - Flask error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] EmailPopup - Successfully loaded email data');
      
      setEmailData(data);
      setError(null);
    } catch (err) {
      console.error('[DEBUG] EmailPopup - Error loading email:', err);
      setError('Failed to load email content. Please try again.');
      // For demo purposes, use mock data
      setEmailData({
        id: emailId,
        sender: 'demo@example.com',
        sender_name: 'Demo User',
        subject: 'Demo Email',
        date: new Date().toISOString(),
        snippet: 'This is a demo email for testing purposes.',
        body: 'This is the full content of the demo email. It contains more detailed information than what was shown in the snippet.',
        to: 'user@example.com'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAvatar = (name: string) => {
    const colors = [
      '#0078d4', '#d13438', '#b146c2', '#00bcf2', 
      '#008272', '#00b7c3', '#038387', '#486991',
      '#7c3f00', '#8764b8', '#00b7c3', '#004e8c'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    
    const initials = name.split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2) || '??';
    
    return { initials, color };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const sanitizeHTML = (html: string) => {
    // Basic HTML sanitization
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove dangerous elements
    const dangerousElements = temp.querySelectorAll('script, object, embed, link[rel="stylesheet"]');
    dangerousElements.forEach(el => el.remove());
    
    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'style') {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return temp.innerHTML;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!emailData && !loading) return null;

  const senderName = emailData?.sender_name || emailData?.sender || 'Unknown Sender';
  const avatar = generateAvatar(senderName);
  const date = emailData ? new Date(emailData.date) : new Date();

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-[1000] overflow-y-auto flex justify-center items-start min-h-full p-5"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden my-auto">
        {/* Popup Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#e1e5e9] bg-[#f8f9fa]">
          <div className="flex-1">
            <h2 className="m-0 text-xl text-[#323130] font-semibold">
              {loading ? 'Loading...' : (emailData?.subject || 'No Subject')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="bg-none border-none text-2xl cursor-pointer text-[#666] p-1 rounded-full w-9 h-9 flex items-center justify-center hover:bg-[#e5e7eb] transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Popup Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="p-5 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading email...</p>
            </div>
          ) : error ? (
            <div className="p-5 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Email Meta Information */}
              <div className="p-5 border-b border-[#e1e5e9]">
                <div className="flex items-center mb-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mr-3 text-sm"
                    style={{ backgroundColor: avatar.color }}
                  >
                    {avatar.initials}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[#323130] mb-0.5">{senderName}</div>
                    <div className="text-[#605e5c] text-sm">{emailData?.sender}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#605e5c] text-sm">{date.toLocaleDateString()}</div>
                    <div className="text-[#605e5c] text-xs">{date.toLocaleTimeString()}</div>
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-[#605e5c] text-sm">To: </span>
                  <span className="text-[#323130] text-sm">{emailData?.to || emailData?.recipient || ''}</span>
                </div>
              </div>

              {/* Email Body */}
              <div className="p-5">
                <div className="leading-relaxed text-[#323130] break-words">
                  {emailData?.html_body ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(emailData.html_body) }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-inherit m-0">
                      {emailData?.body || emailData?.snippet || 'No content available'}
                    </pre>
                  )}
                </div>
                
                {/* Attachments */}
                {emailData?.attachments && emailData.attachments.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-[#e1e5e9]">
                    <h4 className="m-0 mb-4 text-[#323130] text-base">
                      <i className="fas fa-paperclip mr-2"></i>
                      Attachments
                    </h4>
                    <div>
                      {emailData.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center p-2.5 border border-[#e1e5e9] rounded mb-2 cursor-pointer bg-[#f8f9fa] hover:bg-[#e9ecef] transition-colors"
                        >
                          <i className="fas fa-file mr-2.5 text-[#605e5c]"></i>
                          <span className="flex-1 text-[#323130]">
                            {attachment.filename || 'Unknown file'}
                          </span>
                          <span className="text-[#605e5c] text-sm">
                            {formatFileSize(attachment.size || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Popup Actions */}
        <div className="p-5 border-t border-[#e1e5e9] bg-[#f8f9fa] flex gap-2.5">
          <button
            onClick={onReply}
            className="bg-[#0078d4] text-white border-none px-5 py-2.5 rounded cursor-pointer text-sm flex items-center gap-2 hover:bg-[#106ebe] transition-colors"
          >
            <i className="fas fa-reply"></i> Reply
          </button>
          <button
            onClick={onReplyAll}
            className="bg-[#106ebe] text-white border-none px-5 py-2.5 rounded cursor-pointer text-sm flex items-center gap-2 hover:bg-[#005a9e] transition-colors"
          >
            <i className="fas fa-reply-all"></i> Reply All
          </button>
          <button
            onClick={onForward}
            className="bg-[#0078d4] text-white border-none px-5 py-2.5 rounded cursor-pointer text-sm flex items-center gap-2 hover:bg-[#106ebe] transition-colors"
          >
            <i className="fas fa-share"></i> Forward
          </button>
          <button
            onClick={onDelete}
            className="bg-[#d13438] text-white border-none px-5 py-2.5 rounded cursor-pointer text-sm flex items-center gap-2 hover:bg-[#b12a2f] transition-colors"
          >
            <i className="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  );
} 