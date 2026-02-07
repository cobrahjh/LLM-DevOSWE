/**
 * Notepad Widget - SimGlass
 * Quick notes for frequencies, clearances, and flight info
 *
 * Widget Interconnection:
 * - Receives copy-route from flightplan-widget
 * - Receives position-update from map-widget
 */

const TEMPLATES = {
    ATIS: 'ATIS ___: \nWind ___° @ ___ kt\nVis ___ SM\nClouds ___\nTemp ___/___\nAltimeter ___\nRWY ___',
    CLEARANCE: 'CLR to ___\nVia ___\nExpect FL___\nDepart RWY ___\nSquawk ____',
    FREQ: 'GND: ___.___ \nTWR: ___.___ \nDEP: ___.___ \nAPP: ___.___ \nCTR: ___.___',
    SQUAWK: 'Squawk: ____',
    RUNWAY: 'RWY ___\nHDG ___°\nLen ___ ft\nILS ___.___ / ___',
    ALTIMETER: 'QNH: ____ hPa\nAltimeter: __.__ inHg'
};

class NotepadWidget {
    constructor() {
        this.savedItems = [];
        this.loadState();
        this.initElements();
        this.initEvents();
        this.renderSaved();
        this.initSyncListener();
    }

    initSyncListener() {
        // Cross-widget communication
        const syncChannel = new BroadcastChannel('SimGlass-sync');

        syncChannel.onmessage = (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'copy-route':
                    // Received route from flight plan widget
                    this.insertText(data.text);
                    this.showFeedback('Route received from Flight Plan');
                    break;

                case 'waypoint-select':
                    // Could optionally add waypoint info
                    if (data.ident) {
                        this.insertText(`\n--- ${data.ident} ---`);
                    }
                    break;
            }
        };
    }

    insertText(text) {
        const start = this.notesArea.selectionStart;
        const end = this.notesArea.selectionEnd;
        const current = this.notesArea.value;

        // Add newlines if not at start
        const prefix = start > 0 && current[start - 1] !== '\n' ? '\n\n' : '';

        this.notesArea.value = current.substring(0, start) + prefix + text + current.substring(end);
        this.notesArea.focus();
        this.saveState();
    }

    initElements() {
        this.notesArea = document.getElementById('notes');
        this.savedList = document.getElementById('saved-list');
    }

    initEvents() {
        // Quick buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const template = TEMPLATES[btn.dataset.template];
                if (template) {
                    this.insertTemplate(template);
                }
            });
        });

        // Clear button
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (this.notesArea.value && confirm('Clear all notes?')) {
                this.notesArea.value = '';
                this.saveState();
            }
        });

        // Copy button
        document.getElementById('btn-copy').addEventListener('click', () => {
            this.copyAll();
        });

        // Save button
        document.getElementById('btn-add-saved').addEventListener('click', () => {
            this.saveCurrentNote();
        });

        // Auto-save on input
        this.notesArea.addEventListener('input', () => {
            this.saveState();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    this.saveCurrentNote();
                } else if (e.key === 'c' && !window.getSelection().toString()) {
                    // Copy all if no selection
                    this.copyAll();
                }
            }
        });
    }

    insertTemplate(template) {
        const start = this.notesArea.selectionStart;
        const end = this.notesArea.selectionEnd;
        const text = this.notesArea.value;

        // Add newline if not at start
        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n\n' : '';

        this.notesArea.value = text.substring(0, start) + prefix + template + text.substring(end);
        this.notesArea.focus();

        // Position cursor at first blank
        const blankPos = this.notesArea.value.indexOf('___', start);
        if (blankPos !== -1) {
            this.notesArea.setSelectionRange(blankPos, blankPos + 3);
        }

        this.saveState();
    }

    copyAll() {
        if (!this.notesArea.value) return;

        navigator.clipboard.writeText(this.notesArea.value).then(() => {
            this.showFeedback('Copied to clipboard!');
        }).catch(() => {
            // Fallback
            this.notesArea.select();
            document.execCommand('copy');
            this.showFeedback('Copied!');
        });
    }

    showFeedback(message) {
        const existing = document.querySelector('.copy-feedback');
        if (existing) existing.remove();

        const feedback = document.createElement('div');
        feedback.className = 'copy-feedback';
        feedback.textContent = message;
        document.body.appendChild(feedback);

        setTimeout(() => feedback.remove(), 1500);
    }

    saveCurrentNote() {
        const text = this.notesArea.value.trim();
        if (!text) return;

        // Get first line as preview
        const preview = text.split('\n')[0].substring(0, 40);

        this.savedItems.unshift({
            id: Date.now(),
            preview: preview,
            text: text,
            timestamp: new Date().toISOString()
        });

        // Keep only last 10 items
        this.savedItems = this.savedItems.slice(0, 10);

        this.saveState();
        this.renderSaved();
        this.showFeedback('Note saved!');
    }

    renderSaved() {
        this.savedList.replaceChildren();

        if (this.savedItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-saved';
            empty.textContent = 'No saved items. Click + to save current note.';
            this.savedList.appendChild(empty);
            return;
        }

        this.savedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'saved-item';

            const textEl = document.createElement('span');
            textEl.className = 'saved-item-text';
            textEl.textContent = item.preview || 'Note';
            textEl.addEventListener('click', () => {
                this.loadSavedItem(item);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'saved-item-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSavedItem(item.id);
            });

            div.appendChild(textEl);
            div.appendChild(deleteBtn);
            this.savedList.appendChild(div);
        });
    }

    loadSavedItem(item) {
        if (this.notesArea.value && !confirm('Replace current notes with saved item?')) {
            return;
        }
        this.notesArea.value = item.text;
        this.notesArea.focus();
        this.saveState();
    }

    deleteSavedItem(id) {
        this.savedItems = this.savedItems.filter(item => item.id !== id);
        this.saveState();
        this.renderSaved();
    }

    saveState() {
        try {
            localStorage.setItem('notepad-widget-state', JSON.stringify({
                notes: this.notesArea.value,
                savedItems: this.savedItems
            }));
        } catch (e) {}
    }

    loadState() {
        try {
            const saved = localStorage.getItem('notepad-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.savedItems = state.savedItems || [];
                // Defer setting notes until DOM ready
                setTimeout(() => {
                    if (state.notes) {
                        document.getElementById('notes').value = state.notes;
                    }
                }, 0);
            }
        } catch (e) {}
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.notepadWidget = new NotepadWidget();
});
