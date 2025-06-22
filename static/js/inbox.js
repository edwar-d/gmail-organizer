// Global variables
let currentEmails = JSON.parse(document.currentScript.getAttribute('data-emails') || '[]');
let selectedEmailId = null;
let selectedEmailElement = null;
let currentPopupEmailId = null;

console.log(currentEmails)

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize emails data from template
    const emailsScript = document.querySelector('script[data-emails]');
    if (emailsScript) {
        currentEmails = JSON.parse(emailsScript.getAttribute('data-emails'));
    }
});

// Email item click handler - modified to show popup
document.addEventListener('click', function(e) {
    const emailItem = e.target.closest('.email-item');
    if (emailItem) {
        showEmailPopup(emailItem);
    }
});


// Show email popup
async function showEmailPopup(emailItem) {
    const emailId = emailItem.dataset.emailId;
    console.log("emailid ", emailId);

    currentPopupEmailId = emailId;
    
    // Mark as read if unread
    if (emailItem.classList.contains('unread')) {
        markEmailAsRead(emailItem);
    }
    
    // Show loading state
    document.getElementById('emailPopup').style.display = 'block';
    document.getElementById('popupEmailSubject').textContent = 'Loading...';
    
    try {
        // Get email data directly from the HTML dataset
        const emailData = {
            id: emailItem.dataset.emailId,
            sender: emailItem.dataset.sender,
            subject: emailItem.dataset.subject,
            date: emailItem.dataset.date,
            snippet: emailItem.dataset.snippet,
            body: JSON.parse(emailItem.dataset.body) // Parse the JSON-encoded body
        };
        
        displayEmailPopup(emailData);
        
    } catch (error) {
        console.error('Error loading email from dataset:', error);
        document.getElementById('popupEmailSubject').textContent = 'Error loading email';
        document.getElementById('popupEmailBody').innerHTML = '<p style="color: #d13438;">Failed to load email content. Please try again.</p>';
    }
}

// async function showEmailPopup(emailItem) {
//     const emailId = emailItem.dataset.emailId;
//     console.log("emailid ",emailId);

//     currentPopupEmailId = emailId;
    
//     // Mark as read if unread
//     if (emailItem.classList.contains('unread')) {
//         markEmailAsRead(emailItem);
//     }
    
//     // Show loading state
//     document.getElementById('emailPopup').style.display = 'block';
//     document.getElementById('popupEmailSubject').textContent = 'Loading...';
    
//     try {
//         const response = await fetch(`/api/email/${emailId}`);
        
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
        
//         const emailData = await response.json();
        
//         if (emailData.error) {
//             throw new Error(emailData.error);
//         }
        
//         displayEmailPopup(emailData);
        
//     } catch (error) {
//         console.error('Error loading email:', error);
//         document.getElementById('popupEmailSubject').textContent = 'Error loading email';
//         document.getElementById('popupEmailBody').innerHTML = '<p style="color: #d13438;">Failed to load email content. Please try again.</p>';
//     }
// }

// Display email content in popup
function displayEmailPopup(emailData) {
    // Set subject
    document.getElementById('popupEmailSubject').textContent = emailData.subject || 'No Subject';
    
    // Set sender info
    const senderName = emailData.sender_name || emailData.sender || 'Unknown Sender';
    document.getElementById('popupSenderName').textContent = senderName;
    document.getElementById('popupSenderEmail').textContent = emailData.sender || '';
    
    // Generate avatar
    generatePopupAvatar(senderName);
    
    // Set date/time
    const date = new Date(emailData.date || emailData.timestamp);
    document.getElementById('popupEmailDate').textContent = date.toLocaleDateString();
    document.getElementById('popupEmailTime').textContent = date.toLocaleTimeString();
    
    // Set recipients
    document.getElementById('popupToList').textContent = emailData.to || emailData.recipient || '';
    
    // Set email body
    displayPopupEmailBody(emailData);
    
    // Handle attachments
    if (emailData.attachments && emailData.attachments.length > 0) {
        displayPopupAttachments(emailData.attachments);
    } else {
        document.getElementById('popupAttachments').style.display = 'none';
    }
}

// Generate avatar for popup
function generatePopupAvatar(name) {
    const avatar = document.getElementById('popupSenderAvatar');
    const initials = name.split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2) || '??';
    
    avatar.innerHTML = initials;
    avatar.style.backgroundColor = generateAvatarColor(name);
}

// Display email body in popup
function displayPopupEmailBody(emailData) {
    const bodyContainer = document.getElementById('popupEmailBody');
    let content = emailData.html_body || emailData.body || emailData.content || emailData.snippet || 'No content available';
    
    // Debug: Log the raw content
    console.log('Email content type:', emailData.html_body ? 'HTML' : 'Plain text');
    console.log('Raw content preview:', content.substring(0, 500));
    
    if (emailData.html_body) {
        // Render HTML content safely
        bodyContainer.innerHTML = sanitizeHTML(content);
        console.log('Images found:', bodyContainer.querySelectorAll('img').length);
        processPopupEmailImages(bodyContainer);
        processPopupEmailLinks(bodyContainer);
    } else {
        // Check if plain text contains HTML-like content
        if (content.includes('<') && content.includes('>')) {
            bodyContainer.innerHTML = sanitizeHTML(content);
            console.log('HTML-like content detected in plain text');
            console.log('Images found:', bodyContainer.querySelectorAll('img').length);
            processPopupEmailImages(bodyContainer);
            processPopupEmailLinks(bodyContainer);
        } else {
            // Convert plain text to HTML with proper line breaks and link detection
            const htmlContent = convertPlainTextToHTML(content);
            bodyContainer.innerHTML = htmlContent;
            processPopupEmailLinks(bodyContainer);
        }
    }
}

// Process images in popup
function processPopupEmailImages(container) {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        // Fix Gmail image URLs
        fixGmailImageUrl(img);
        
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.cursor = 'pointer';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        img.style.display = 'block';
        
        img.addEventListener('click', function() {
            enlargeImage(this.src);
        });
        
        // Add loading state
        img.addEventListener('load', function() {
            this.style.opacity = '1';
            console.log('Image loaded successfully:', this.src);
        });
        
        img.addEventListener('error', function() {
            console.error('Failed to load image:', this.src);
            // Try alternative sources
            const altSrc = this.getAttribute('data-src') || this.getAttribute('data-original-src');
            if (altSrc && altSrc !== this.src) {
                console.log('Trying alternative source:', altSrc);
                this.src = altSrc;
            } else {
                this.style.display = 'none';
            }
        });
        
        img.style.opacity = '0.7';
        img.style.transition = 'opacity 0.3s ease';
        
        // Force reload if image seems blocked
        if (!img.complete || img.naturalHeight === 0) {
            const src = img.src;
            img.src = '';
            img.src = src;
        }
    });
}

// Fix Gmail image URLs
function fixGmailImageUrl(img) {
    let src = img.getAttribute('src') || '';
    const originalSrc = src;
    
    // Store original source for fallback
    img.setAttribute('data-original-src', originalSrc);
    
    // Handle various Gmail image URL patterns
    if (src.includes('googleusercontent.com') || src.includes('ggpht.com')) {
        // These are usually valid, just ensure HTTPS
        if (src.startsWith('http:')) {
            src = src.replace('http:', 'https:');
        }
    } else if (src.includes('ci3.googleusercontent.com') || src.includes('ci4.googleusercontent.com') || 
               src.includes('ci5.googleusercontent.com') || src.includes('ci6.googleusercontent.com')) {
        // These are Gmail proxy URLs, usually work as-is
        if (!src.startsWith('https://')) {
            src = 'https:' + (src.startsWith('//') ? src : '//' + src);
        }
    }
    
    // Update src if changed
    if (src !== originalSrc) {
        console.log('Updated image URL from', originalSrc, 'to', src);
        img.src = src;
    }
    
    // Remove any Gmail-specific blocking attributes
    img.removeAttribute('blocked');
    img.removeAttribute('data-blocked');
    img.removeAttribute('data-surl');
    
    // If the image has a data-src attribute, try that
    const dataSrc = img.getAttribute('data-src');
    if (dataSrc && !img.src) {
        img.src = dataSrc;
    }
}

// Process links in popup
function processPopupEmailLinks(container) {
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.color = '#0078d4';
        link.style.textDecoration = 'underline';
        link.style.fontWeight = '500';
        
        link.addEventListener('mouseenter', function() {
            this.style.color = '#106ebe';
            this.style.textDecoration = 'none';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.color = '#0078d4';
            this.style.textDecoration = 'underline';
        });
    });
}

// Convert plain text to HTML with link detection
function convertPlainTextToHTML(text) {
    // Escape HTML first
    const escaped = escapeHTML(text);
    
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
    const withLinks = escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #0078d4; text-decoration: underline; font-weight: 500;">$1</a>');
    
    // Convert email addresses to mailto links
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    const withEmails = withLinks.replace(emailRegex, '<a href="mailto:$1" style="color: #0078d4; text-decoration: underline; font-weight: 500;">$1</a>');
    
    // Convert line breaks to <br> tags
    const withBreaks = withEmails.replace(/\n/g, '<br>');
    
    return `<div style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6;">${withBreaks}</div>`;
}

// Display attachments in popup
function displayPopupAttachments(attachments) {
    const attachmentsSection = document.getElementById('popupAttachments');
    const attachmentsList = document.getElementById('popupAttachmentsList');
    
    attachmentsList.innerHTML = '';
    attachments.forEach(attachment => {
        const attachmentItem = document.createElement('div');
        attachmentItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px;
            border: 1px solid #e1e5e9;
            border-radius: 4px;
            margin-bottom: 8px;
            cursor: pointer;
            background: #f8f9fa;
        `;
        
        attachmentItem.innerHTML = `
            <i class="fas fa-file" style="margin-right: 10px; color: #605e5c;"></i>
            <span style="flex: 1; color: #323130;">${attachment.filename || attachment.name || 'Unknown file'}</span>
            <span style="color: #605e5c; font-size: 14px;">${formatFileSize(attachment.size || 0)}</span>
        `;
        
        attachmentItem.addEventListener('click', function() {
            downloadAttachment(attachment);
        });
        
        attachmentsList.appendChild(attachmentItem);
    });
    
    attachmentsSection.style.display = 'block';
}

// Close popup
function closeEmailPopup() {
    document.getElementById('emailPopup').style.display = 'none';
    currentPopupEmailId = null;
}

// Popup action functions
function replyToEmailFromPopup() {
    if (currentPopupEmailId) {
        window.location.href = `/compose?reply=${currentPopupEmailId}`;
    }
}

function replyAllToEmailFromPopup() {
    if (currentPopupEmailId) {
        window.location.href = `/compose?replyall=${currentPopupEmailId}`;
    }
}

function forwardEmailFromPopup() {
    if (currentPopupEmailId) {
        window.location.href = `/compose?forward=${currentPopupEmailId}`;
    }
}

function deleteEmailFromPopup() {
    if (currentPopupEmailId && confirm('Are you sure you want to delete this email?')) {
        deleteEmail(currentPopupEmailId);
        closeEmailPopup();
    }
}

// Generate AI reply from popup
async function generateReplyFromPopup() {
    if (!currentPopupEmailId) {
        alert('No email selected');
        return;
    }

    // Get the current email data
    const emailItem = document.querySelector(`[data-email-id="${currentPopupEmailId}"]`);
    if (!emailItem) {
        alert('Email data not found');
        return;
    }

    // Extract email data
    const emailData = {
        id: currentPopupEmailId,
        subject: emailItem.dataset.subject || '',
        sender: emailItem.dataset.sender || '',
        body: emailItem.dataset.body || emailItem.dataset.snippet || ''
    };

    // Try to parse body if it's JSON
    try {
        emailData.body = JSON.parse(emailData.body);
    } catch (e) {
        // Keep as is if not JSON
    }

    // Close popup
    closeEmailPopup();

    // Show loading state
    showGenerateReplyLoading();

    try {
        // Call the generate reply API
        const response = await fetch('/api/generate-reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email_id: emailData.id,
                tone: 'professional', // Default tone
                subject: emailData.subject,
                sender: emailData.sender,
                body: emailData.body
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate reply');
        }

        const data = await response.json();
        
        // Hide loading
        hideGenerateReplyLoading();
        
        // Show the generated reply in a modal
        showGeneratedReplyModal(data.reply, emailData);

    } catch (error) {
        console.error('Error generating reply:', error);
        hideGenerateReplyLoading();
        alert(`Failed to generate reply: ${error.message}`);
    }
}

// Show loading state for reply generation
function showGenerateReplyLoading() {
    const loadingHTML = `
        <div id="replyGenerationLoading" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 2000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px;">
                <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #8b5cf6, #ec4899); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-magic" style="color: white; font-size: 24px; animation: pulse 2s infinite;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0; color: #1e293b;">Generating Reply...</h3>
                <p style="color: #64748b; margin: 0;">Our AI is crafting the perfect response</p>
                <div style="margin-top: 20px;">
                    <div style="display: inline-block; width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%; margin: 0 4px; animation: bounce 1.4s infinite ease-in-out both;"></div>
                    <div style="display: inline-block; width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%; margin: 0 4px; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div>
                    <div style="display: inline-block; width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%; margin: 0 4px; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div>
                </div>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

// Hide loading state
function hideGenerateReplyLoading() {
    const loading = document.getElementById('replyGenerationLoading');
    if (loading) {
        loading.remove();
    }
}

// Show generated reply modal
function showGeneratedReplyModal(replyText, emailData) {
    const modalHTML = `
        <div id="generatedReplyModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: white; border-radius: 12px; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; color: #1e293b; font-size: 20px;">Generated Reply</h2>
                    <button onclick="closeGeneratedReplyModal()" style="background: none; border: none; font-size: 24px; color: #6b7280; cursor: pointer; padding: 4px; border-radius: 4px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="flex: 1; padding: 24px; overflow-y: auto;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Tone:</label>
                        <select id="replyTone" onchange="regenerateReply()" style="padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; width: 200px;">
                            <option value="professional" selected>Professional</option>
                            <option value="friendly">Friendly</option>
                            <option value="formal">Formal</option>
                            <option value="casual">Casual</option>
                            <option value="enthusiastic">Enthusiastic</option>
                            <option value="apologetic">Apologetic</option>
                            <option value="grateful">Grateful</option>
                        </select>
                    </div>
                    
                    <textarea id="generatedReplyText" style="width: 100%; min-height: 300px; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 15px; line-height: 1.6; resize: vertical; font-family: inherit;">${escapeHTML(replyText)}</textarea>
                </div>
                
                <div style="padding: 20px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
                    <button onclick="sendGeneratedReplyWithGmail()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-paper-plane"></i> Send with Gmail
                    </button>
                    <button onclick="copyGeneratedReply()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button onclick="closeGeneratedReplyModal()" style="background: white; color: #64748b; border: 2px solid #e5e7eb; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store email data for regeneration
    window.currentReplyEmailData = emailData;
}

// Close generated reply modal
function closeGeneratedReplyModal() {
    const modal = document.getElementById('generatedReplyModal');
    if (modal) {
        modal.remove();
    }
    window.currentReplyEmailData = null;
}

// Regenerate reply with different tone
async function regenerateReply() {
    const tone = document.getElementById('replyTone').value;
    const emailData = window.currentReplyEmailData;
    
    if (!emailData) return;
    
    // Show loading in textarea
    const textarea = document.getElementById('generatedReplyText');
    textarea.value = 'Regenerating reply...';
    textarea.disabled = true;
    
    try {
        const response = await fetch('/api/generate-reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email_id: emailData.id,
                tone: tone,
                subject: emailData.subject,
                sender: emailData.sender,
                body: emailData.body
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate reply');
        }

        const data = await response.json();
        textarea.value = data.reply;
        
    } catch (error) {
        console.error('Error regenerating reply:', error);
        textarea.value = 'Error generating reply. Please try again.';
    } finally {
        textarea.disabled = false;
    }
}

// Send generated reply with Gmail
function sendGeneratedReplyWithGmail() {
    const replyText = document.getElementById('generatedReplyText').value;
    const emailData = window.currentReplyEmailData;
    
    if (!replyText || !emailData) return;
    
    const subject = 'Re: ' + (emailData.subject || '');
    const to = emailData.sender || '';
    const body = encodeURIComponent(replyText);
    
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${body}`;
    
    window.open(gmailUrl, '_blank');
    closeGeneratedReplyModal();
}

// Copy generated reply
function copyGeneratedReply() {
    const textarea = document.getElementById('generatedReplyText');
    if (!textarea) return;
    
    textarea.select();
    document.execCommand('copy');
    
    // Show feedback
    const copyBtn = event.target.closest('button');
    if (copyBtn) {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
    }
}

// Keyboard event handlers
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEmailPopup();
        document.querySelectorAll('.image-overlay').forEach(overlay => overlay.remove());
    }
    
    if (e.key === 'Delete' && selectedEmailId) {
        deleteCurrentEmail();
    }
});

// Close popup when clicking outside
document.getElementById('emailPopup').addEventListener('click', function(e) {
    if (e.target === this) {
        closeEmailPopup();
    }
});

// Original email selection functions
function selectEmail(emailItem) {
    const emailId = emailItem.dataset.emailId;
    
    // Remove previous selection
    document.querySelectorAll('.email-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to current item
    emailItem.classList.add('selected');
    selectedEmailElement = emailItem;
    selectedEmailId = emailId;
    
    // Mark as read if unread
    if (emailItem.classList.contains('unread')) {
        markEmailAsRead(emailItem);
    }
    
    // Use the new EmailViewer if available, otherwise fallback to old method
    if (window.emailViewer) {
        window.emailViewer.selectEmail(emailId);
    } else if (typeof selectEmailInViewer === 'function') {
        selectEmailInViewer(emailId);
    } else {
        // Fallback to old email content loading
        loadEmailContent(emailId);
    }
}

function markEmailAsRead(emailItem) {
    emailItem.classList.remove('unread');
    const indicator = emailItem.querySelector('.unread-indicator');
    if (indicator) {
        indicator.remove();
    }
    
    // Update server
    const emailId = emailItem.dataset.emailId;
    fetch(`/api/email/${emailId}/mark-read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }).catch(error => {
        console.error('Error marking email as read:', error);
    });
}

async function loadEmailContent(emailId) {
    showLoading();
    
    try {
        const response = await fetch(`/api/email/${emailId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const emailData = await response.json();
        
        if (emailData.error) {
            throw new Error(emailData.error);
        }
        
        hideLoading();
        displayEmailContent(emailData);
        
    } catch (error) {
        console.error('Error loading email:', error);
        hideLoading();
        showError('Failed to load email content. Please try again.');
    }
}

function showLoading() {
    document.getElementById('noEmailSelected').style.display = 'none';
    document.getElementById('emailContent').style.display = 'none';
    document.getElementById('emailLoading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('emailLoading').style.display = 'none';
    document.getElementById('emailContent').style.display = 'block';
}

function displayEmailContent(emailData) {
    // Populate email header
    document.getElementById('emailSubjectLarge').textContent = emailData.subject || 'No Subject';
    document.getElementById('emailFromLarge').textContent = emailData.sender_name || emailData.sender || 'Unknown Sender';
    document.getElementById('emailFromEmail').textContent = emailData.sender || '';
    
    // Format and display date/time
    const date = new Date(emailData.date || emailData.timestamp);
    document.getElementById('emailDateLarge').textContent = date.toLocaleDateString();
    document.getElementById('emailTimeLarge').textContent = date.toLocaleTimeString();
    
    // Display recipients
    document.getElementById('emailToLarge').textContent = emailData.to || emailData.recipient || '';
    
    // Generate avatar
    generateAvatar(emailData.sender_name || emailData.sender || 'Unknown');
    
    // Display email body
    displayEmailBody(emailData);
    
    // Handle attachments
    if (emailData.attachments && emailData.attachments.length > 0) {
        displayAttachments(emailData.attachments);
    } else {
        document.getElementById('emailAttachments').style.display = 'none';
    }
    
    // Scroll to top of email content
    const bodyContainer = document.querySelector('.email-body-container');
    if (bodyContainer) {
        bodyContainer.scrollTop = 0;
    }
}

function generateAvatar(name) {
    const avatar = document.getElementById('senderAvatar');
    const initials = name.split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2) || '??';
    
    avatar.innerHTML = initials;
    avatar.style.backgroundColor = generateAvatarColor(name);
    avatar.style.color = 'white';
    avatar.style.fontWeight = 'bold';
}

function generateAvatarColor(text) {
    const colors = [
        '#0078d4', '#d13438', '#b146c2', '#00bcf2', 
        '#008272', '#00b7c3', '#038387', '#486991',
        '#7c3f00', '#8764b8', '#00b7c3', '#004e8c'
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function displayEmailBody(emailData) {
    const bodyContainer = document.getElementById('emailBodyContent');
    let content = emailData.html_body || emailData.body || emailData.content || emailData.snippet || 'No content available';
    
    if (emailData.html_body) {
        // Render HTML content safely
        bodyContainer.innerHTML = sanitizeHTML(content);
        processEmailImages(bodyContainer);
        processEmailLinks(bodyContainer);
    } else {
        // Check if plain text contains HTML-like content
        if (content.includes('<') && content.includes('>')) {
            bodyContainer.innerHTML = sanitizeHTML(content);
            processEmailImages(bodyContainer);
            processEmailLinks(bodyContainer);
        } else {
            // Convert plain text to HTML with proper line breaks and link detection
            const htmlContent = convertPlainTextToHTML(content);
            bodyContainer.innerHTML = htmlContent;
            processEmailLinks(bodyContainer);
        }
    }
}

function sanitizeHTML(html) {
    // Basic HTML sanitization
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove dangerous elements
    const dangerousElements = temp.querySelectorAll('script, object, embed, form, input, button');
    dangerousElements.forEach(el => el.remove());
    
    // Remove dangerous attributes but keep safe ones
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        const attributes = [...el.attributes];
        attributes.forEach(attr => {
            // Remove event handlers and dangerous attributes
            if (attr.name.startsWith('on') || 
                attr.name === 'javascript:' ||
                (attr.name === 'style' && attr.value.includes('javascript:'))) {
                el.removeAttribute(attr.name);
            }
        });
        
        // Ensure links open in new tab
        if (el.tagName.toLowerCase() === 'a') {
            el.target = '_blank';
            el.rel = 'noopener noreferrer';
            if (!el.style.color) {
                el.style.color = '#0078d4';
                el.style.textDecoration = 'underline';
                el.style.fontWeight = '500';
            }
        }
        
        // Handle images - fix Gmail proxy URLs and cid references
        if (el.tagName.toLowerCase() === 'img') {
            let src = el.getAttribute('src') || '';
            
            // Handle cid: references (embedded images)
            if (src.startsWith('cid:')) {
                // For now, hide cid images as they require special handling
                el.style.display = 'none';
                return;
            }
            
            // Handle relative URLs or proxy URLs
            if (!src.startsWith('http://') && !src.startsWith('https://')) {
                // If it's a relative URL, it might be a Gmail proxy
                if (src.startsWith('//')) {
                    src = 'https:' + src;
                } else if (src.startsWith('/')) {
                    src = 'https://mail.google.com' + src;
                }
                el.src = src;
            }
            
            // Gmail sometimes uses data-src instead of src
            const dataSrc = el.getAttribute('data-src');
            if (dataSrc && !src) {
                el.src = dataSrc;
            }
            
            // Remove any blocking attributes
            el.removeAttribute('blocked');
            el.removeAttribute('data-blocked');
            
            // Style images for better display
            el.style.maxWidth = '100%';
            el.style.height = 'auto';
            el.style.borderRadius = '8px';
            el.style.margin = '8px 0';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            el.style.cursor = 'pointer';
            el.style.display = 'block';
            
            // Add error handling
            el.onerror = function() {
                console.error('Failed to load image:', this.src);
                this.style.display = 'none';
            };
        }
    });
    
    return temp.innerHTML;
}

function processEmailImages(container) {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        // Fix Gmail image URLs
        fixGmailImageUrl(img);
        
        img.classList.add('email-image');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        img.style.cursor = 'pointer';
        img.style.display = 'block';
        
        img.addEventListener('load', function() {
            this.classList.add('loaded');
            this.style.opacity = '1';
            console.log('Main viewer image loaded:', this.src);
        });
        
        img.addEventListener('error', function() {
            console.error('Main viewer failed to load image:', this.src);
            // Try alternative sources
            const altSrc = this.getAttribute('data-src') || this.getAttribute('data-original-src');
            if (altSrc && altSrc !== this.src) {
                console.log('Main viewer trying alternative source:', altSrc);
                this.src = altSrc;
            } else {
                this.style.display = 'none';
            }
        });
        
        img.addEventListener('click', function() {
            enlargeImage(this.src);
        });
        
        img.style.opacity = '0.7';
        img.style.transition = 'opacity 0.3s ease';
        
        // Force reload if image seems blocked
        if (!img.complete || img.naturalHeight === 0) {
            const src = img.src;
            img.src = '';
            img.src = src;
        }
    });
}

function processEmailLinks(container) {
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.color = '#0078d4';
        link.style.textDecoration = 'underline';
        link.style.fontWeight = '500';
        
        link.addEventListener('mouseenter', function() {
            this.style.color = '#106ebe';
            this.style.textDecoration = 'none';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.color = '#0078d4';
            this.style.textDecoration = 'underline';
        });
    });
}

function enlargeImage(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    overlay.innerHTML = `
        <div class="image-modal" style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${src}" alt="Enlarged image" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            <button class="close-modal" style="position: absolute; top: -40px; right: 0; background: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.closest('.close-modal')) {
            overlay.remove();
        }
    });
    
    document.body.appendChild(overlay);
}

function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayAttachments(attachments) {
    const attachmentsSection = document.getElementById('emailAttachments');
    const attachmentsList = document.getElementById('attachmentsList');
    
    attachmentsList.innerHTML = '';
    attachments.forEach(attachment => {
        const attachmentItem = document.createElement('div');
        attachmentItem.className = 'attachment-item';
        attachmentItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 8px;
            cursor: pointer;
        `;
        
        attachmentItem.innerHTML = `
            <i class="fas fa-file" style="margin-right: 8px;"></i>
            <span class="attachment-name" style="flex: 1;">${attachment.filename || attachment.name || 'Unknown file'}</span>
            <span class="attachment-size" style="color: #666; font-size: 0.9em;">${formatFileSize(attachment.size || 0)}</span>
        `;
        
        attachmentItem.addEventListener('click', function() {
downloadAttachment(attachment);
        });
        
        attachmentsList.appendChild(attachmentItem);
    });
    
    attachmentsSection.style.display = 'block';
}

function downloadAttachment(attachment) {
    // Handle attachment download
    if (attachment.url) {
        window.open(attachment.url, '_blank');
    } else if (attachment.id) {
        window.location.href = `/api/attachment/${attachment.id}/download`;
    } else {
        console.log('Attachment download not available');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d13438;
        color: white;
        padding: 15px;
        border-radius: 4px;
        z-index: 1001;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Other existing functions that might be referenced...
function replyToEmail() {
    if (selectedEmailId) {
        window.location.href = `/compose?reply=${selectedEmailId}`;
    }
}

function replyAllToEmail() {
    if (selectedEmailId) {
        window.location.href = `/compose?replyall=${selectedEmailId}`;
    }
}

function forwardEmail() {
    if (selectedEmailId) {
        window.location.href = `/compose?forward=${selectedEmailId}`;
    }
}

function deleteCurrentEmail() {
    if (selectedEmailId && confirm('Are you sure you want to delete this email?')) {
        deleteEmail(selectedEmailId);
    }
}

function deleteEmail(emailId) {
    fetch(`/api/email/${emailId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (response.ok) {
            // Remove email from list
            const emailItem = document.querySelector(`[data-email-id="${emailId}"]`);
            if (emailItem) {
                emailItem.remove();
            }
            
            // Clear selection if this was the selected email
            if (selectedEmailId === emailId) {
                selectedEmailId = null;
                selectedEmailElement = null;
                document.getElementById('emailContent').style.display = 'none';
                document.getElementById('noEmailSelected').style.display = 'block';
            }
        } else {
            showError('Failed to delete email');
        }
    })
    .catch(error => {
        console.error('Error deleting email:', error);
        showError('Failed to delete email');
    });
}

function markSelectedAsRead() {
    if (selectedEmailElement) {
        markEmailAsRead(selectedEmailElement);
    }
}

function deleteSelectedEmail() {
    if (selectedEmailId && confirm('Are you sure you want to delete this email?')) {
        deleteEmail(selectedEmailId);
    }
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const emailItems = document.querySelectorAll('.email-item');
    
    emailItems.forEach(item => {
        const sender = item.dataset.sender.toLowerCase();
        const subject = item.dataset.subject.toLowerCase();
        const snippet = item.dataset.snippet.toLowerCase();
        
        if (sender.includes(searchTerm) || subject.includes(searchTerm) || snippet.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
});