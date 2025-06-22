/**
 * Email Viewer JavaScript Implementation
 * Provides rich email content display with HTML support, markdown rendering, 
 * link previews, and image handling for the static frontend
 */

class EmailViewer {
    constructor() {
        this.selectedEmailId = null;
        this.emailData = null;
        this.loading = false;
        this.error = null;
        this.linkPreviews = [];
        this.showImages = false;
        this.init();
    }

    init() {
        // Create email viewer container if it doesn't exist
        if (!document.getElementById('email-viewer-container')) {
            this.createEmailViewerContainer();
        }
        this.bindEvents();
    }

    createEmailViewerContainer() {
        const container = document.createElement('div');
        container.id = 'email-viewer-container';
        container.className = 'email-viewer-container';
        container.innerHTML = `
            <div class="email-viewer-content">
                <div class="email-viewer-empty">
                    <div class="empty-state">
                        <i class="fas fa-envelope-open"></i>
                        <h3>Select an email to read</h3>
                        <p>Choose an email from the list to view its contents</p>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after email list or at appropriate location
        const emailList = document.querySelector('.email-list');
        if (emailList && emailList.parentNode) {
            emailList.parentNode.insertBefore(container, emailList.nextSibling);
        } else {
            document.body.appendChild(container);
        }
    }

    bindEvents() {
        // Listen for email selection events
        document.addEventListener('emailSelected', (event) => {
            this.selectEmail(event.detail.emailId);
        });

        // Listen for action button clicks
        document.addEventListener('click', (event) => {
            if (event.target.matches('.email-viewer-reply')) {
                this.onReply();
            } else if (event.target.matches('.email-viewer-reply-all')) {
                this.onReplyAll();
            } else if (event.target.matches('.email-viewer-forward')) {
                this.onForward();
            } else if (event.target.matches('.email-viewer-generate-reply')) {
                this.onGenerateReply();
            } else if (event.target.matches('.email-viewer-delete')) {
                this.onDelete();
            } else if (event.target.matches('.email-viewer-toggle-images')) {
                this.toggleImages();
            } else if (event.target.matches('.link-preview-card')) {
                const url = event.target.dataset.url;
                if (url) window.open(url, '_blank');
            }
        });
    }

    async selectEmail(emailId) {
        if (!emailId) {
            this.showEmptyState();
            return;
        }

        this.selectedEmailId = emailId;
        await this.loadEmailData();
    }

    async loadEmailData() {
        if (!this.selectedEmailId) return;

        try {
            this.showLoading();
            
            console.log('[DEBUG] EmailViewer - Loading email data for:', this.selectedEmailId);
            const response = await fetch(`/api/email/${this.selectedEmailId}`, {
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

            this.emailData = data;
            this.renderEmail();
            
            // Extract and preview links
            await this.extractAndPreviewLinks(data.body || data.html_body || '');

        } catch (err) {
            console.error('[DEBUG] EmailViewer - Error loading email:', err);
            this.showError('Failed to load email content. Please try again.');
        }
    }

    showLoading() {
        const container = document.getElementById('email-viewer-container');
        container.innerHTML = `
            <div class="email-viewer-content">
                <div class="email-viewer-loading">
                    <div class="loading-spinner"></div>
                    <span>Loading email...</span>
                </div>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('email-viewer-container');
        container.innerHTML = `
            <div class="email-viewer-content">
                <div class="email-viewer-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    showEmptyState() {
        const container = document.getElementById('email-viewer-container');
        container.innerHTML = `
            <div class="email-viewer-content">
                <div class="email-viewer-empty">
                    <div class="empty-state">
                        <i class="fas fa-envelope-open"></i>
                        <h3>Select an email to read</h3>
                        <p>Choose an email from the list to view its contents</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderEmail() {
        if (!this.emailData) return;

        const senderName = this.emailData.sender_name || this.emailData.sender || 'Unknown Sender';
        const avatar = this.generateAvatar(senderName);
        const date = new Date(this.emailData.date);

        // Determine content type
        const hasHtmlTags = /<[^>]+>/.test(this.emailData.html_body || this.emailData.body || '');
        const hasMarkdownSyntax = /[#*`\[\]_]/.test(this.emailData.body || '');

        const container = document.getElementById('email-viewer-container');
        container.innerHTML = `
            <div class="email-viewer-content">
                <div class="email-viewer-header">
                    <div class="email-actions">
                        <button class="email-viewer-reply action-btn primary">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                        <button class="email-viewer-reply-all action-btn">
                            <i class="fas fa-reply-all"></i> Reply All
                        </button>
                        <button class="email-viewer-forward action-btn">
                            <i class="fas fa-share"></i> Forward
                        </button>
                        <button class="email-viewer-generate-reply action-btn" style="background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white;">
                            <i class="fas fa-magic"></i> Generate Reply
                        </button>
                        <button class="email-viewer-delete action-btn danger">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                        ${(hasHtmlTags || this.emailData.html_body) ? `
                            <button class="email-viewer-toggle-images action-btn ${this.showImages ? 'active' : ''}">
                                <i class="fas ${this.showImages ? 'fa-eye-slash' : 'fa-eye'}"></i>
                                ${this.showImages ? 'Hide' : 'Show'} Images
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="email-header-info">
                        <h1 class="email-subject">${this.escapeHtml(this.emailData.subject)}</h1>
                        
                        <div class="email-meta">
                            <div class="sender-info">
                                <div class="sender-avatar" style="background-color: ${avatar.color}">
                                    ${avatar.initials}
                                </div>
                                <div class="sender-details">
                                    <div class="sender-name">${this.escapeHtml(senderName)}</div>
                                    <div class="sender-email">${this.escapeHtml(this.emailData.sender)}</div>
                                </div>
                            </div>
                            <div class="email-date">
                                <div class="date">${date.toLocaleDateString()}</div>
                                <div class="time">${date.toLocaleTimeString()}</div>
                            </div>
                        </div>
                        
                        <div class="email-recipient">
                            <span class="label">To:</span>
                            <span class="value">${this.escapeHtml(this.emailData.to || this.emailData.recipient || '')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="email-viewer-body">
                    <div class="email-content">
                        ${this.renderEmailContent()}
                    </div>
                    
                    <div id="link-previews-container"></div>
                    
                    ${this.emailData.attachments && this.emailData.attachments.length > 0 ? `
                        <div class="email-attachments">
                            <h4><i class="fas fa-paperclip"></i> Attachments</h4>
                            ${this.renderAttachments()}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderEmailContent() {
        if (!this.emailData) return '';

        const hasHtmlTags = /<[^>]+>/.test(this.emailData.html_body || this.emailData.body || '');
        const hasMarkdownSyntax = /[#*`\[\]_]/.test(this.emailData.body || '');

        if (this.emailData.html_body) {
            return this.sanitizeHTML(this.emailData.html_body);
        } else if (hasMarkdownSyntax) {
            return this.renderMarkdown(this.emailData.body || '');
        } else {
            return `<pre class="plain-text">${this.escapeHtml(this.emailData.body || this.emailData.snippet || 'No content available')}</pre>`;
        }
    }

    sanitizeHTML(html) {
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove dangerous elements
        const dangerousElements = temp.querySelectorAll('script, object, embed, form, input, button');
        dangerousElements.forEach(el => el.remove());

        // Handle images
        const images = temp.querySelectorAll('img');
        images.forEach(img => {
            if (!this.showImages) {
                // Replace with placeholder
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder';
                placeholder.innerHTML = `
                    <div class="image-blocked">
                        <i class="fas fa-image"></i>
                        <div>Image blocked for security</div>
                        <div class="image-src">src: ${img.src}</div>
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
    }

    renderMarkdown(text) {
        // Simple markdown-like rendering
        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
            
            // Bold and italic
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            
            // Code blocks
            .replace(/```([\s\S]*?)```/gim, '<pre class="code-block"><code>$1</code></pre>')
            .replace(/`([^`]+)`/gim, '<code class="inline-code">$1</code>')
            
            // Lists
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            
            // Line breaks
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');

        // Wrap in paragraph if not already wrapped
        if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
            html = `<p>${html}</p>`;
        }

        // Wrap lists in ul tags
        html = html.replace(/(<li[^>]*>.*<\/li>)/gim, '<ul>$1</ul>');

        return html;
    }

    renderAttachments() {
        if (!this.emailData.attachments) return '';

        return this.emailData.attachments.map(attachment => `
            <div class="attachment-item">
                <i class="fas fa-file"></i>
                <span class="filename">${this.escapeHtml(attachment.filename || 'Unknown file')}</span>
                <span class="filesize">${this.formatFileSize(attachment.size || 0)}</span>
            </div>
        `).join('');
    }

    async extractAndPreviewLinks(content) {
        // Extract URLs from content
        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
        const urls = content.match(urlRegex) || [];

        if (urls.length === 0) return;

        // Limit to first 3 URLs to avoid too many requests
        const limitedUrls = [...new Set(urls)].slice(0, 3);

        const previews = [];

        for (const url of limitedUrls) {
            try {
                const mockPreview = await this.getMockLinkPreview(url);
                if (mockPreview) {
                    previews.push(mockPreview);
                }
            } catch (error) {
                console.error('Error fetching link preview:', error);
            }
        }

        this.linkPreviews = previews;
        this.renderLinkPreviews();
    }

    async getMockLinkPreview(url) {
        // Mock link preview data based on common domains
        const domain = new URL(url).hostname;

        const mockPreviews = {
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
        };
    }

    renderLinkPreviews() {
        const container = document.getElementById('link-previews-container');
        if (!container || this.linkPreviews.length === 0) return;

        container.innerHTML = `
            <div class="link-previews">
                <h4><i class="fas fa-link"></i> Link Previews</h4>
                ${this.linkPreviews.map(preview => `
                    <div class="link-preview-card" data-url="${preview.url}">
                        <div class="preview-content">
                            ${preview.image && this.showImages ? `
                                <img src="${preview.image}" alt="${preview.title}" class="preview-image" 
                                     onerror="this.style.display='none'">
                            ` : ''}
                            <div class="preview-text">
                                <h5 class="preview-title">${this.escapeHtml(preview.title || 'Link Preview')}</h5>
                                ${preview.description ? `
                                    <p class="preview-description">${this.escapeHtml(preview.description)}</p>
                                ` : ''}
                                <div class="preview-url">
                                    <i class="fas fa-external-link-alt"></i>
                                    <span>${this.escapeHtml(preview.siteName || new URL(preview.url).hostname)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    toggleImages() {
        this.showImages = !this.showImages;
        this.renderEmail();
        if (this.linkPreviews.length > 0) {
            this.renderLinkPreviews();
        }
    }

    generateAvatar(name) {
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
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event handlers
    onReply() {
        console.log('Reply to email:', this.selectedEmailId);
        // Implement reply functionality
        alert('Reply functionality would be implemented here');
    }

    onReplyAll() {
        console.log('Reply all to email:', this.selectedEmailId);
        // Implement reply all functionality
        alert('Reply All functionality would be implemented here');
    }

    onForward() {
        console.log('Forward email:', this.selectedEmailId);
        // Implement forward functionality
        alert('Forward functionality would be implemented here');
    }

    async onGenerateReply() {
        console.log('Generate reply for email:', this.selectedEmailId);
        if (!this.selectedEmailId || !this.emailData) {
            alert('Please select an email first');
            return;
        }

        // Show loading state
        const generateBtn = document.querySelector('.email-viewer-generate-reply');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        try {
            // Call the generate reply API directly
            const response = await fetch('/api/generate-reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email_id: this.selectedEmailId,
                    tone: 'professional', // Default tone
                    subject: this.emailData.subject || '',
                    sender: this.emailData.sender || '',
                    body: this.emailData.body || this.emailData.snippet || ''
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate reply');
            }

            const data = await response.json();
            
            // Show the generated reply in a modal or popup
            this.showReplyModal(data.reply);

        } catch (error) {
            console.error('Error generating reply:', error);
            alert(`Failed to generate reply: ${error.message}`);
        } finally {
            // Restore button state
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Reply';
            }
        }
    }

    showReplyModal(replyText) {
        // Create modal HTML
        const modalHTML = `
            <div id="reply-modal" class="email-reply-modal">
                <div class="reply-modal-content">
                    <div class="reply-modal-header">
                        <h2>Generated Reply</h2>
                        <button class="reply-modal-close" onclick="emailViewer.closeReplyModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="reply-modal-body">
                        <div class="reply-options">
                            <label for="reply-tone">Tone:</label>
                            <select id="reply-tone" class="reply-tone-selector">
                                <option value="professional" selected>Professional</option>
                                <option value="friendly">Friendly</option>
                                <option value="formal">Formal</option>
                                <option value="casual">Casual</option>
                                <option value="enthusiastic">Enthusiastic</option>
                                <option value="apologetic">Apologetic</option>
                                <option value="grateful">Grateful</option>
                            </select>
                            <button class="regenerate-btn" onclick="emailViewer.regenerateReply()">
                                <i class="fas fa-sync"></i> Regenerate
                            </button>
                        </div>
                        <textarea id="reply-text" class="reply-textarea">${this.escapeHtml(replyText)}</textarea>
                    </div>
                    <div class="reply-modal-footer">
                        <button class="reply-action-btn send-gmail" onclick="emailViewer.sendWithGmail()">
                            <i class="fas fa-paper-plane"></i> Send with Gmail
                        </button>
                        <button class="reply-action-btn copy" onclick="emailViewer.copyReply()">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button class="reply-action-btn edit" onclick="emailViewer.editReply()">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add modal styles if not already present
        if (!document.getElementById('reply-modal-styles')) {
            const styles = `
                <style id="reply-modal-styles">
                    .email-reply-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                        animation: fadeIn 0.3s ease-out;
                    }

                    .reply-modal-content {
                        background: white;
                        border-radius: 12px;
                        width: 90%;
                        max-width: 700px;
                        max-height: 80vh;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                        animation: slideIn 0.3s ease-out;
                    }

                    .reply-modal-header {
                        padding: 20px;
                        border-bottom: 1px solid #e5e7eb;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .reply-modal-header h2 {
                        margin: 0;
                        color: #1e293b;
                        font-size: 20px;
                    }

                    .reply-modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        color: #6b7280;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.2s;
                    }

                    .reply-modal-close:hover {
                        background: #f3f4f6;
                        color: #374151;
                    }

                    .reply-modal-body {
                        flex: 1;
                        padding: 20px;
                        overflow-y: auto;
                    }

                    .reply-options {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 16px;
                    }

                    .reply-tone-selector {
                        padding: 8px 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 6px;
                        font-size: 14px;
                        background: white;
                        cursor: pointer;
                    }

                    .regenerate-btn {
                        background: #8b5cf6;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: all 0.2s;
                    }

                    .regenerate-btn:hover {
                        background: #7c3aed;
                        transform: translateY(-1px);
                    }

                    .reply-textarea {
                        width: 100%;
                        min-height: 300px;
                        padding: 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 15px;
                        line-height: 1.6;
                        resize: vertical;
                        font-family: inherit;
                    }

                    .reply-textarea:focus {
                        outline: none;
                        border-color: #8b5cf6;
                        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
                    }

                    .reply-modal-footer {
                        padding: 16px 20px;
                        border-top: 1px solid #e5e7eb;
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                    }

                    .reply-action-btn {
                        padding: 10px 20px;
                        border-radius: 6px;
                        border: none;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                    }

                    .reply-action-btn.send-gmail {
                        background: #10b981;
                        color: white;
                    }

                    .reply-action-btn.send-gmail:hover {
                        background: #059669;
                        transform: translateY(-1px);
                    }

                    .reply-action-btn.copy {
                        background: #3b82f6;
                        color: white;
                    }

                    .reply-action-btn.copy:hover {
                        background: #2563eb;
                        transform: translateY(-1px);
                    }

                    .reply-action-btn.edit {
                        background: white;
                        color: #64748b;
                        border: 2px solid #e5e7eb;
                    }

                    .reply-action-btn.edit:hover {
                        background: #f8fafc;
                        border-color: #cbd5e1;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: scale(0.95) translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }
                </style>
            `;
            document.head.insertAdjacentHTML('beforeend', styles);
        }
    }

    closeReplyModal() {
        const modal = document.getElementById('reply-modal');
        if (modal) {
            modal.remove();
        }
    }

    async regenerateReply() {
        const toneSelector = document.getElementById('reply-tone');
        const tone = toneSelector ? toneSelector.value : 'professional';
        
        // Close current modal
        this.closeReplyModal();
        
        // Generate with new tone
        await this.generateReplyWithTone(tone);
    }

    async generateReplyWithTone(tone) {
        if (!this.selectedEmailId || !this.emailData) {
            return;
        }

        // Show loading state
        const generateBtn = document.querySelector('.email-viewer-generate-reply');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        try {
            const response = await fetch('/api/generate-reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email_id: this.selectedEmailId,
                    tone: tone,
                    subject: this.emailData.subject || '',
                    sender: this.emailData.sender || '',
                    body: this.emailData.body || this.emailData.snippet || ''
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate reply');
            }

            const data = await response.json();
            this.showReplyModal(data.reply);

        } catch (error) {
            console.error('Error generating reply:', error);
            alert(`Failed to generate reply: ${error.message}`);
        } finally {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Reply';
            }
        }
    }

    sendWithGmail() {
        const replyText = document.getElementById('reply-text');
        if (!replyText || !replyText.value) {
            alert('No reply text to send');
            return;
        }

        const subject = 'Re: ' + (this.emailData.subject || '');
        const to = this.emailData.sender || '';
        const body = encodeURIComponent(replyText.value);

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${body}`;
        
        window.open(gmailUrl, '_blank');
        this.closeReplyModal();
    }

    copyReply() {
        const replyText = document.getElementById('reply-text');
        if (!replyText) return;

        replyText.select();
        document.execCommand('copy');

        // Show feedback
        const copyBtn = event.target.closest('.copy');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }
    }

    editReply() {
        const replyText = document.getElementById('reply-text');
        if (replyText) {
            replyText.focus();
            replyText.setSelectionRange(replyText.value.length, replyText.value.length);
        }
    }

    onDelete() {
        if (confirm('Are you sure you want to delete this email?')) {
            console.log('Delete email:', this.selectedEmailId);
            // Implement delete functionality
            fetch(`/api/email/${this.selectedEmailId}`, {
                method: 'DELETE',
                credentials: 'include'
            }).then(() => {
                this.showEmptyState();
                // Refresh email list
                location.reload();
            }).catch(err => {
                console.error('Error deleting email:', err);
                alert('Failed to delete email');
            });
        }
    }
}

// Initialize email viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.emailViewer = new EmailViewer();
});

// Helper function to trigger email selection from other scripts
function selectEmailInViewer(emailId) {
    const event = new CustomEvent('emailSelected', {
        detail: { emailId: emailId }
    });
    document.dispatchEvent(event);
} 