'use client';

import { useState, useEffect } from 'react';

interface EmailViewerProps {
  selectedEmailId: string | null;
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

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export default function EmailViewer({ selectedEmailId, onReply, onReplyAll, onForward, onDelete }: EmailViewerProps) {
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [showImages, setShowImages] = useState(false);

  useEffect(() => {
    if (selectedEmailId) {
      loadEmailData();
    } else {
      setEmailData(null);
      setError(null);
      setLinkPreviews([]);
    }
  }, [selectedEmailId]);

  const loadEmailData = async () => {
    if (!selectedEmailId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('[DEBUG] EmailViewer - Loading email data for:', selectedEmailId);
      const response = await fetch(`http://localhost:5000/api/email/${selectedEmailId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[DEBUG] EmailViewer - Flask response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[DEBUG] EmailViewer - Flask error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] EmailViewer - Successfully loaded email data');
      
      setEmailData(data);
      
      // Extract and preview links
      extractAndPreviewLinks(data.body || data.html_body || '');
      
    } catch (err) {
      console.error('[DEBUG] EmailViewer - Error loading email:', err);
      setError('Failed to load email content. Please try again.');
      // For demo purposes, use mock data
      setEmailData({
        id: selectedEmailId,
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

  const extractAndPreviewLinks = async (content: string) => {
    // Extract URLs from content
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
    const urls = content.match(urlRegex) || [];
    
    if (urls.length === 0) return;

    // Limit to first 3 URLs to avoid too many requests
    const limitedUrls = [...new Set(urls)].slice(0, 3);
    
    const previews: LinkPreview[] = [];
    
    for (const url of limitedUrls) {
      try {
        // For demo purposes, create mock previews
        // In a real app, you'd call a link preview service
        const mockPreview = await getMockLinkPreview(url);
        if (mockPreview) {
          previews.push(mockPreview);
        }
      } catch (error) {
        console.error('Error fetching link preview:', error);
      }
    }
    
    setLinkPreviews(previews);
  };

  const getMockLinkPreview = async (url: string): Promise<LinkPreview | null> => {
    // Mock link preview data based on common domains
    const domain = new URL(url).hostname;
    
    const mockPreviews: { [key: string]: Partial<LinkPreview> } = {
      'github.com': {
        title: 'GitHub Repository',
        description: 'A collaborative platform for version control and code sharing.',
        image: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        siteName: 'GitHub'
      },
      'youtube.com': {
        title: 'YouTube Video',
        description: 'Watch this amazing video content.',
        image: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        siteName: 'YouTube'
      },
      'linkedin.com': {
        title: 'LinkedIn Post',
        description: 'Professional networking and career development.',
        image: 'https://content.linkedin.com/content/dam/me/business/en-us/amp/brand-site/v2/bg/LI-Bug.svg.original.svg',
        siteName: 'LinkedIn'
      },
      'twitter.com': {
        title: 'Twitter Post',
        description: 'Join the conversation on Twitter.',
        image: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
        siteName: 'Twitter'
      }
    };

    const preview = mockPreviews[domain] || {
      title: 'Link Preview',
      description: 'Click to visit this link.',
      siteName: domain
    };

    return {
      url,
      ...preview
    } as LinkPreview;
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
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove dangerous elements
    const dangerousElements = temp.querySelectorAll('script, object, embed, form, input, button');
    dangerousElements.forEach(el => el.remove());
    
    // Handle images
    const images = temp.querySelectorAll('img');
    images.forEach(img => {
      if (!showImages) {
        // Replace with placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.innerHTML = `
          <div style="
            background: #f0f0f0; 
            border: 2px dashed #ccc; 
            padding: 20px; 
            text-align: center; 
            margin: 10px 0;
            border-radius: 8px;
            color: #666;
          ">
            <i class="fas fa-image" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            <div>Image blocked for security</div>
            <div style="font-size: 12px; margin-top: 4px;">src: ${img.src}</div>
          </div>
        `;
        img.replaceWith(placeholder);
      } else {
        // Style images for responsive display
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '10px 0';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }
    });
    
    // Handle links
    const links = temp.querySelectorAll('a');
    links.forEach(link => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.color = '#0078d4';
      link.style.textDecoration = 'underline';
    });
    
    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (attr.name.startsWith('on') || 
            (attr.name === 'style' && !['img', 'div', 'span', 'p'].includes(el.tagName.toLowerCase()))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return temp.innerHTML;
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown-like rendering
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 style="color: #323130; margin: 16px 0 8px 0; font-size: 18px; font-weight: 600;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="color: #323130; margin: 20px 0 10px 0; font-size: 22px; font-weight: 600;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="color: #323130; margin: 24px 0 12px 0; font-size: 26px; font-weight: 600;">$1</h1>')
      
      // Bold and italic
      .replace(/\*\*(.*)\*\*/gim, '<strong style="font-weight: 600;">$1</strong>')
      .replace(/\*(.*)\*/gim, '<em style="font-style: italic;">$1</em>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #0078d4; text-decoration: underline;">$1</a>')
      
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #0078d4; margin: 12px 0; overflow-x: auto;"><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code style="background: #f8f9fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px;">$1</code>')
      
      // Lists
      .replace(/^\* (.*$)/gim, '<li style="margin: 4px 0;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin: 4px 0;">$1</li>')
      
      // Line breaks
      .replace(/\n\n/gim, '</p><p style="margin: 12px 0; line-height: 1.5;">')
      .replace(/\n/gim, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
      html = `<p style="margin: 12px 0; line-height: 1.5;">${html}</p>`;
    }

    // Wrap lists in ul tags
    html = html.replace(/(<li[^>]*>.*<\/li>)/gim, '<ul style="margin: 12px 0; padding-left: 24px;">$1</ul>');

    return html;
  };

  const LinkPreviewCard = ({ preview }: { preview: LinkPreview }) => (
    <div className="border border-[#e1dfdd] rounded-lg p-4 mb-4 hover:shadow-md transition-shadow cursor-pointer bg-[#fafafa]"
         onClick={() => window.open(preview.url, '_blank')}>
      <div className="flex gap-4">
        {preview.image && showImages && (
          <img 
            src={preview.image} 
            alt={preview.title}
            className="w-20 h-20 object-cover rounded-md flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#323130] text-sm mb-1 truncate">
            {preview.title || 'Link Preview'}
          </h4>
          {preview.description && (
            <p className="text-[#605e5c] text-xs mb-2 line-clamp-2">
              {preview.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-[#8a8886]">
            <i className="fas fa-external-link-alt"></i>
            <span className="truncate">{preview.siteName || new URL(preview.url).hostname}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!selectedEmailId) {
    return (
      <div className="flex-[2] bg-white flex flex-col">
        <div className="flex justify-center items-center h-full bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]">
          <div className="text-center text-[#605e5c]">
            <i className="fas fa-envelope-open text-6xl mb-6 opacity-60 text-[#8a8886]"></i>
            <h3 className="text-2xl mb-3 font-normal text-[#323130]">Select an email to read</h3>
            <p className="text-base opacity-80">Choose an email from the list to view its contents</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-[2] bg-white flex flex-col">
        <div className="flex justify-center items-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <span className="text-[#605e5c]">Loading email...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-[2] bg-white flex flex-col">
        <div className="flex justify-center items-center h-full">
          <div className="text-center text-[#d13438]">
            <i className="fas fa-exclamation-triangle text-5xl mb-4"></i>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!emailData) return null;

  const senderName = emailData.sender_name || emailData.sender || 'Unknown Sender';
  const avatar = generateAvatar(senderName);
  const date = new Date(emailData.date);

  // Determine if content is likely HTML or Markdown
  const hasHtmlTags = /<[^>]+>/.test(emailData.html_body || emailData.body || '');
  const hasMarkdownSyntax = /[#*`\[\]_]/.test(emailData.body || '');

  return (
    <div className="flex-[2] bg-white flex flex-col">
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-b from-[#fafafa] to-[#f5f5f5] border-b border-[#e1dfdd] p-6 flex-shrink-0">
          <div className="flex gap-3 mb-5">
            <button
              onClick={onReply}
              className="bg-white border border-[#e1dfdd] px-4 py-2.5 rounded-md cursor-pointer transition-all duration-300 text-sm flex items-center gap-2 font-medium hover:-translate-y-0.5 hover:shadow-lg bg-[#0078d4] text-white border-[#0078d4]"
              title="Reply"
            >
              <i className="fas fa-reply"></i> Reply
            </button>
            <button
              onClick={onReplyAll}
              className="bg-white border border-[#e1dfdd] px-4 py-2.5 rounded-md cursor-pointer transition-all duration-300 text-sm flex items-center gap-2 font-medium hover:-translate-y-0.5 hover:shadow-lg"
              title="Reply All"
            >
              <i className="fas fa-reply-all"></i> Reply All
            </button>
            <button
              onClick={onForward}
              className="bg-white border border-[#e1dfdd] px-4 py-2.5 rounded-md cursor-pointer transition-all duration-300 text-sm flex items-center gap-2 font-medium hover:-translate-y-0.5 hover:shadow-lg"
              title="Forward"
            >
              <i className="fas fa-share"></i> Forward
            </button>
            <button
              onClick={onDelete}
              className="bg-white border border-[#e1dfdd] px-4 py-2.5 rounded-md cursor-pointer transition-all duration-300 text-sm flex items-center gap-2 font-medium hover:-translate-y-0.5 hover:shadow-lg text-[#d13438] border-[#d13438] hover:bg-[#d13438] hover:text-white"
              title="Delete"
            >
              <i className="fas fa-trash"></i>
            </button>
            
            {/* Show Images Toggle */}
            {(hasHtmlTags || emailData.html_body) && (
              <button
                onClick={() => setShowImages(!showImages)}
                className={`px-4 py-2.5 rounded-md cursor-pointer transition-all duration-300 text-sm flex items-center gap-2 font-medium hover:-translate-y-0.5 hover:shadow-lg ${
                  showImages 
                    ? 'bg-[#0078d4] text-white border-[#0078d4]' 
                    : 'bg-white border border-[#e1dfdd]'
                }`}
                title={showImages ? "Hide Images" : "Show Images"}
              >
                <i className={`fas ${showImages ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                {showImages ? 'Hide' : 'Show'} Images
              </button>
            )}
          </div>
          
          <div className="mb-5">
            <h1 className="text-2xl font-semibold text-[#323130] mb-4">{emailData.subject}</h1>
          </div>
          
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mr-3 text-sm"
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initials}
              </div>
              <div>
                <div className="font-semibold text-[#323130] text-base">{senderName}</div>
                <div className="text-[#605e5c] text-sm">{emailData.sender}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#323130] text-base font-medium">{date.toLocaleDateString()}</div>
              <div className="text-[#605e5c] text-sm">{date.toLocaleTimeString()}</div>
            </div>
          </div>
          
          <div className="border-t border-[#e1dfdd] pt-4">
            <div className="flex items-center">
              <span className="text-[#605e5c] font-medium mr-2">To:</span>
              <span className="text-[#323130]">{emailData.to || emailData.recipient || ''}</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="leading-relaxed text-[#323130] break-words email-content">
            {emailData.html_body ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(emailData.html_body) }} />
            ) : hasMarkdownSyntax ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(emailData.body || '') }} />
            ) : (
              <pre className="whitespace-pre-wrap font-inherit m-0 leading-relaxed">
                {emailData.body || emailData.snippet || 'No content available'}
              </pre>
            )}
          </div>
          
          {/* Link Previews */}
          {linkPreviews.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#e1dfdd]">
              <h4 className="text-[#323130] text-base font-semibold mb-4 flex items-center gap-2">
                <i className="fas fa-link"></i>
                Link Previews
              </h4>
              {linkPreviews.map((preview, index) => (
                <LinkPreviewCard key={index} preview={preview} />
              ))}
            </div>
          )}
          
          {/* Attachments */}
          {emailData.attachments && emailData.attachments.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#e1dfdd]">
              <h4 className="m-0 mb-4 text-[#323130] text-base font-semibold">
                <i className="fas fa-paperclip mr-2"></i>
                Attachments
              </h4>
              <div>
                {emailData.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center p-3 border border-[#e1dfdd] rounded-md mb-2 cursor-pointer bg-[#f8f9fa] hover:bg-[#e9ecef] transition-colors"
                  >
                    <i className="fas fa-file mr-3 text-[#605e5c]"></i>
                    <span className="flex-1 text-[#323130] font-medium">
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
      </div>
    </div>
  );
} 