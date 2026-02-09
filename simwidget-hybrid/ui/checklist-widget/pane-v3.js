/**
 * Checklist Pane v3.0.0 - SimGlass
 * Aircraft-specific checklists with lazy-loaded aircraft data
 *
 * Code splitting: Aircraft data loaded on-demand by category
 * - Reduces initial load from 2222 to ~440 lines (80% reduction)
 * - Loads only needed aircraft categories
 * - Improves page load time and memory usage
 */

class ChecklistPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'checklist-widget',
            widgetVersion: '3.0.0',
            autoConnect: false  // Local checklist display, no WebSocket
        });

        this.currentAircraft = 'generic';
        this.currentChecklist = 'preflight';
        this.checkedItems = {};
        this.audioEnabled = true;
        this.synth = window.speechSynthesis;
        this.loadingAircraft = false;

        this.aircraftSelect = null;
        this.checklistTabs = null;
        this.checklistContainer = null;

        // Load saved state and initialize
        this.loadState();
        this.init();
    }

    async init() {
        // Ensure generic aircraft is loaded (always available)
        await this.ensureAircraftLoaded('generic');

        this.initAircraftSelector();
        this.initTabs();
        this.initControls();
        this.initKeyboard();
        await this.renderChecklist();
    }

    async ensureAircraftLoaded(aircraftId) {
        if (this.loadingAircraft) return;

        // Check if already loaded
        if (AIRCRAFT_CHECKLISTS[aircraftId]) {
            return;
        }

        this.loadingAircraft = true;
        this.showLoadingIndicator();

        try {
            await loadAircraftData(aircraftId);
            if (!AIRCRAFT_CHECKLISTS[aircraftId]) {
                throw new Error(`Failed to load aircraft: ${aircraftId}`);
            }
        } catch (err) {
            console.error('[Checklist] Aircraft load error:', err);
            window.telemetry?.captureError?.(err, { context: 'aircraft-load', aircraftId });
            this.showError(`Failed to load ${aircraftId} checklists. Using generic.`);
            this.currentAircraft = 'generic';
        } finally {
            this.loadingAircraft = false;
            this.hideLoadingIndicator();
        }
    }

    showLoadingIndicator() {
        const container = document.getElementById('checklist-container');
        if (container) {
            container.innerHTML = '<div class="loading-spinner">Loading aircraft data...</div>';
        }
    }

    hideLoadingIndicator() {
        // Will be cleared by renderChecklist()
    }

    showError(message) {
        const container = document.getElementById('checklist-container');
        if (container) {
            container.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }

    get checklists() {
        const aircraft = AIRCRAFT_CHECKLISTS[this.currentAircraft];
        return aircraft ? aircraft.checklists : {};
    }

    initAircraftSelector() {
        const select = document.getElementById('aircraft-select');
        if (!select) return;

        this.aircraftSelect = select;
        select.value = this.currentAircraft;

        select.addEventListener('change', async () => {
            const newAircraft = select.value;
            await this.changeAircraft(newAircraft);
        });
    }

    async changeAircraft(aircraftId) {
        if (aircraftId === this.currentAircraft) return;

        // Load aircraft data if needed
        await this.ensureAircraftLoaded(aircraftId);

        this.currentAircraft = aircraftId;
        this.currentChecklist = 'preflight';
        this.renderTabs();
        await this.renderChecklist();
        this.saveState();
    }

    initTabs() {
        const tabs = document.getElementById('checklist-tabs');
        if (!tabs) return;

        this.checklistTabs = tabs;
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const checklist = e.target.dataset.checklist;
                this.switchChecklist(checklist);
            }
        });
        this.renderTabs();
    }

    renderTabs() {
        if (!this.checklistTabs) return;

        const checklists = this.checklists;
        const tabsHtml = Object.keys(checklists).map(key => {
            const cl = checklists[key];
            const active = key === this.currentChecklist ? 'active' : '';
            return `<button class="tab ${active}" data-checklist="${key}">${cl.name}</button>`;
        }).join('');

        this.checklistTabs.innerHTML = tabsHtml;
    }

    switchChecklist(checklistKey) {
        this.currentChecklist = checklistKey;
        this.renderTabs();
        this.renderChecklist();
        this.saveState();
    }

    initControls() {
        // Audio toggle
        const audioBtn = document.getElementById('btn-audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                this.audioEnabled = !this.audioEnabled;
                audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
                this.saveState();
            });
            audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
        }

        // Reset current
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCurrent());
        }

        // Navigation
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigatePhase(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigatePhase(1));
        }
    }

    initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    this.toggleCurrentItem();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateItem(-1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateItem(1);
                    break;
                case 'ArrowLeft':
                    this.navigatePhase(-1);
                    break;
                case 'ArrowRight':
                    this.navigatePhase(1);
                    break;
                case 'r':
                case 'R':
                    if (e.ctrlKey) {
                        this.resetAll();
                    } else {
                        this.resetCurrent();
                    }
                    break;
                case 'a':
                case 'A':
                    this.audioEnabled = !this.audioEnabled;
                    document.getElementById('btn-audio').textContent = this.audioEnabled ? '🔊' : '🔇';
                    this.saveState();
                    break;
                case '1': case '2': case '3': case '4':
                case '5': case '6': case '7':
                    this.jumpToPhase(parseInt(e.key) - 1);
                    break;
            }
        });
    }

    async renderChecklist() {
        const container = document.getElementById('checklist-container');
        if (!container) return;

        const checklists = this.checklists;
        const currentCl = checklists[this.currentChecklist];
        if (!currentCl) {
            container.innerHTML = '<div class="error-message">Checklist not found</div>';
            return;
        }

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        const itemsHtml = currentCl.items.map((item, index) => {
            const isChecked = checked.includes(index);
            const checkClass = isChecked ? 'checked' : '';
            const criticalClass = item.critical ? 'critical' : item.warning ? 'warning' : '';

            return `
                <div class="checklist-item ${checkClass} ${criticalClass}" data-index="${index}">
                    <div class="item-checkbox">${isChecked ? '✅' : '⬜'}</div>
                    <div class="item-content">
                        <span class="item-text">${item.text}</span>
                        <span class="item-action">${item.action}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = itemsHtml;

        // Add click handlers
        container.querySelectorAll('.checklist-item').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                this.toggleItem(index);
            });
        });

        this.updateProgress();
    }

    toggleItem(index, fromRemote = false) {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        const idx = checked.indexOf(index);
        if (idx > -1) {
            checked.splice(idx, 1);
        } else {
            checked.push(index);

            // Announce if audio enabled
            if (this.audioEnabled && !fromRemote) {
                const currentCl = this.checklists[this.currentChecklist];
                const item = currentCl.items[index];
                if (item && this.synth) {
                    const utterance = new SpeechSynthesisUtterance(`${item.text}... ${item.action}`);
                    utterance.rate = 0.9;
                    this.synth.speak(utterance);
                }
            }
        }

        this.checkedItems[itemKey] = checked;
        this.saveState();
        this.renderChecklist();

        // Broadcast to other widgets if not from remote
        if (!fromRemote) {
            this.broadcastAction('toggleItem', { index });
        }
    }

    toggleCurrentItem() {
        const items = document.querySelectorAll('.checklist-item');
        const unchecked = Array.from(items).find(el => !el.classList.contains('checked'));
        if (unchecked) {
            const index = parseInt(unchecked.dataset.index);
            this.toggleItem(index);
        }
    }

    navigateItem(direction) {
        // Implementation for item navigation
        const items = Array.from(document.querySelectorAll('.checklist-item'));
        const current = items.findIndex(el => el.classList.contains('highlight'));

        let newIndex = current + direction;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= items.length) newIndex = items.length - 1;

        items.forEach((el, i) => {
            el.classList.toggle('highlight', i === newIndex);
        });

        items[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    navigatePhase(direction) {
        const phases = Object.keys(this.checklists);
        const currentIndex = phases.indexOf(this.currentChecklist);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = phases.length - 1;
        if (newIndex >= phases.length) newIndex = 0;

        this.switchChecklist(phases[newIndex]);
    }

    jumpToPhase(index) {
        const phases = Object.keys(this.checklists);
        if (index >= 0 && index < phases.length) {
            this.switchChecklist(phases[index]);
        }
    }

    updateProgress() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];
        const currentCl = this.checklists[this.currentChecklist];
        const total = currentCl ? currentCl.items.length : 0;

        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill && progressText) {
            const percent = total > 0 ? (checked.length / total) * 100 : 0;
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${checked.length}/${total}`;
        }
    }

    resetCurrent() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        this.checkedItems[itemKey] = [];
        this.saveState();
        this.renderChecklist();
        this.broadcastAction('resetChecklist', { checklist: this.currentChecklist });
    }

    resetAll() {
        if (confirm('Reset all checklists for this aircraft?')) {
            const aircraft = this.currentAircraft;
            Object.keys(this.checkedItems).forEach(key => {
                if (key.startsWith(aircraft + '_')) {
                    delete this.checkedItems[key];
                }
            });
            this.saveState();
            this.renderChecklist();
        }
    }

    broadcastAction(action, data) {
        if (!this.syncChannel) return;
        this.syncChannel.postMessage({
            type: 'checklist-update',
            action,
            data: { ...data, aircraft: this.currentAircraft },
            source: 'checklist-widget'
        });
    }

    saveState() {
        const state = {
            currentAircraft: this.currentAircraft,
            currentChecklist: this.currentChecklist,
            checkedItems: this.checkedItems,
            audioEnabled: this.audioEnabled
        };
        localStorage.setItem('simglass_checklist_state', JSON.stringify(state));
    }

    loadState() {
        try {
            const saved = localStorage.getItem('simglass_checklist_state');
            if (saved) {
                const state = JSON.parse(saved);
                this.currentAircraft = state.currentAircraft || 'generic';
                this.currentChecklist = state.currentChecklist || 'preflight';
                this.checkedItems = state.checkedItems || {};
                this.audioEnabled = state.audioEnabled !== undefined ? state.audioEnabled : true;
            }
        } catch (e) {
            console.error('[Checklist] State load error:', e);
        }
    }

    destroy() {
        if (this.synth) {
            this.synth.cancel();
        }
        super.destroy();
    }
}

// Initialize widget
let checklist;
document.addEventListener('DOMContentLoaded', async () => {
    // Load generic aircraft first (fastest load)
    await loadAircraftData('generic');

    checklist = new ChecklistPane();
    window.checklist = checklist;
});
