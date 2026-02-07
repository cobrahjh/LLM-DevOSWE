/**
 * SimGlass Feedback Section v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Feedback form section for settings panel.
 * Include: <script src="/ui/shared/feedback-section.js"></script>
 */

class FeedbackSection {
    constructor(telemetry) {
        this.telemetry = telemetry;
        this.maxChars = 200;
    }
    
    /**
     * Get section config for SettingsPanel.registerSection()
     */
    getConfig() {
        return {
            title: 'Feedback',
            icon: '💬',
            render: () => this.render(),
            onMount: (container) => this.onMount(container)
        };
    }
    
    render() {
        return `
            <div class="feedback-section">
                <p class="feedback-intro">Help us improve SimGlass! Share your thoughts, report issues, or suggest features.</p>
                
                <div class="feedback-rating">
                    <label>How's your experience?</label>
                    <div class="rating-stars" id="feedback-rating">
                        <button class="star" data-rating="1" title="Poor">★</button>
                        <button class="star" data-rating="2" title="Fair">★</button>
                        <button class="star" data-rating="3" title="Good">★</button>
                        <button class="star" data-rating="4" title="Great">★</button>
                        <button class="star" data-rating="5" title="Excellent">★</button>
                    </div>
                </div>
                
                <div class="feedback-input">
                    <label for="feedback-text">Your feedback</label>
                    <textarea 
                        id="feedback-text" 
                        placeholder="What's working well? What could be better?"
                        maxlength="${this.maxChars}"
                        rows="4"
                    ></textarea>
                    <div class="char-count">
                        <span id="feedback-chars">0</span>/${this.maxChars}
                    </div>
                </div>
                
                <div class="feedback-actions">
                    <button class="btn btn-primary" id="feedback-submit">
                        📤 Submit Feedback
                    </button>
                </div>
                
                <div class="feedback-status" id="feedback-status"></div>
                
                <div class="feedback-footer">
                    <small>Feedback is anonymous and helps improve SimGlass for everyone.</small>
                </div>
            </div>
        `;
    }
    
    onMount(container) {
        const textarea = container.querySelector('#feedback-text');
        const charCount = container.querySelector('#feedback-chars');
        const ratingBtns = container.querySelectorAll('.star');
        const submitBtn = container.querySelector('#feedback-submit');
        const statusEl = container.querySelector('#feedback-status');
        
        let selectedRating = 0;
        
        // Character counter
        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
            charCount.parentElement.classList.toggle('near-limit', textarea.value.length > this.maxChars - 20);
        });
        
        // Rating selection
        ratingBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectedRating = parseInt(btn.dataset.rating);
                ratingBtns.forEach((b, i) => {
                    b.classList.toggle('active', i < selectedRating);
                });
            });
            
            btn.addEventListener('mouseenter', () => {
                const rating = parseInt(btn.dataset.rating);
                ratingBtns.forEach((b, i) => {
                    b.classList.toggle('hover', i < rating);
                });
            });
            
            btn.addEventListener('mouseleave', () => {
                ratingBtns.forEach(b => b.classList.remove('hover'));
            });
        });
        
        // Submit
        submitBtn.addEventListener('click', async () => {
            const feedback = textarea.value.trim();
            
            if (!feedback && !selectedRating) {
                this.showStatus(statusEl, 'Please enter feedback or select a rating', 'error');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Sending...';
            
            const result = await this.telemetry.submitFeedback(feedback, selectedRating);
            
            if (result.success) {
                this.showStatus(statusEl, '✅ Thank you for your feedback!', 'success');
                textarea.value = '';
                charCount.textContent = '0';
                selectedRating = 0;
                ratingBtns.forEach(b => b.classList.remove('active'));
            } else {
                this.showStatus(statusEl, `❌ Failed to send: ${result.error}`, 'error');
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Submit Feedback';
        });
    }
    
    showStatus(el, message, type) {
        el.textContent = message;
        el.className = 'feedback-status ' + type;
        
        // Auto-clear after 5 seconds
        setTimeout(() => {
            el.textContent = '';
            el.className = 'feedback-status';
        }, 5000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeedbackSection;
}
