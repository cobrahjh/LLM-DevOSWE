/**
 * Notepad pane - SimGlass
 * Quick notes for frequencies, clearances, and flight info
 *
 * glass Interconnection:
 * - Receives copy-route from flightplan-glass
 * - Receives position-update from map-glass
 */

const TEMPLATES = {
    ATIS: 'ATIS ___: \nWind ___° @ ___ kt\nVis ___ SM\nClouds ___\nTemp ___/___\nAltimeter ___\nRWY ___',
    CLEARANCE: 'CLR to ___\nVia ___\nExpect FL___\nDepart RWY ___\nSquawk ____',
    FREQ: 'GND: ___.___ \nTWR: ___.___ \nDEP: ___.___ \nAPP: ___.___ \nCTR: ___.___',
    SQUAWK: 'Squawk: ____',
    RUNWAY: 'RWY ___\nHDG ___°\nLen ___ ft\nILS ___.___ / ___',
    ALTIMETER: 'QNH: ____ hPa\nAltimeter: __.__ inHg'
};

class NotepadPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'notepad-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for notes
        });

        this.savedItems = [];
        this.compactMode = localStorage.getItem('notepad-widget-compact') === 'true';
        this.loadState();
        this.initElements();
        this.initEvents();
        this.setupCompactToggle();
        this.renderSaved();
        this.initSyncListener();
    }

    initSyncListener() {
        // cross-pane communication
        this.syncChannel = new SafeChannel('SimGlass-sync');

        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'copy-route':
                    // Received route from Flight Plan pane
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
        this.syncCompactTextarea();
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
                this.syncCompactTextarea();
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

        this.syncCompactTextarea();
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
        this.syncCompactTextarea();
        this.saveState();
    }

    deleteSavedItem(id) {
        this.savedItems = this.savedItems.filter(item => item.id !== id);
        this.saveState();
        this.renderSaved();
    }

    saveState() {
        try {
            localStorage.setItem('notepad-glass-state', JSON.stringify({
                notes: this.notesArea.value,
                savedItems: this.savedItems
            }));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveState',
                    glass: 'notepad-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('notepad-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.savedItems = state.savedItems || [];
                // Defer setting notes until DOM ready
                setTimeout(() => {
                    if (state.notes) {
                        document.getElementById('notes').value = state.notes;
                        const compactNotes = document.getElementById('np-compact-notes');
                        if (compactNotes) compactNotes.value = state.notes;
                        this.updateCompact();
                    }
                }, 0);
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadState',
                    glass: 'notepad-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    syncCompactTextarea() {
        const compactNotes = document.getElementById('np-compact-notes');
        if (compactNotes) {
            compactNotes.value = this.notesArea.value;
            this.updateCompact();
        }
    }

    setupCompactToggle() {
        const btn = document.getElementById('compact-toggle');
        const compactNotes = document.getElementById('np-compact-notes');

        if (this.compactMode) {
            document.body.classList.add('compact-mode');
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            const nowCompact = document.body.classList.toggle('compact-mode');
            btn.classList.toggle('active', nowCompact);
            localStorage.setItem('notepad-widget-compact', nowCompact);
            this.compactMode = nowCompact;

            if (nowCompact) {
                // Sync full -> compact
                compactNotes.value = this.notesArea.value;
                this.updateCompact();
            } else {
                // Sync compact -> full
                this.notesArea.value = compactNotes.value;
                this.saveState();
            }
        });

        // Sync compact textarea input back to full textarea
        compactNotes.addEventListener('input', () => {
            this.notesArea.value = compactNotes.value;
            this.saveState();
            this.updateCompact();
        });

        // Also sync full textarea to compact when full textarea changes
        this.notesArea.addEventListener('input', () => {
            compactNotes.value = this.notesArea.value;
            this.updateCompact();
        });

        // Initial sync
        if (this.compactMode) {
            setTimeout(() => {
                compactNotes.value = this.notesArea.value;
                this.updateCompact();
            }, 10);
        }
    }

    updateCompact() {
        const statsEl = document.getElementById('np-stats');
        if (!statsEl) return;

        const text = this.notesArea.value || '';
        const chars = text.length;
        const lines = text ? text.split('\n').length : 0;

        if (chars === 0) {
            statsEl.textContent = '0 chars';
        } else {
            statsEl.textContent = chars + ' ch / ' + lines + ' ln';
        }
    }

    destroy() {
        // Close BroadcastChannel
        if (this.syncChannel) {
            this.syncChannel.close();
            this.syncChannel = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.NotepadPane = new NotepadPane();
    window.addEventListener('beforeunload', () => window.NotepadPane?.destroy());
});
