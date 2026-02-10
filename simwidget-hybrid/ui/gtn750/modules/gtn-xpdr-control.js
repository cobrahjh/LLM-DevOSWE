/**
 * GTN750 Transponder Control Panel v1.0.0
 * Octal keypad, mode selection, IDENT with 18s auto-off
 */
class GTNXpdrControl {
    constructor({ elements, serverPort }) {
        this.serverPort = serverPort || 8080;
        this._code = [1, 2, 0, 0];
        this._digitIdx = -1; // -1 = not entering
        this._mode = 4; // ALT default
        this._identActive = false;
        this._identTimer = null;
        this._visible = false;
        this._destroyed = false;

        // Cache modal elements
        this._modal = document.getElementById('xpdr-modal');
        this._digits = [
            document.getElementById('xpdr-d0'),
            document.getElementById('xpdr-d1'),
            document.getElementById('xpdr-d2'),
            document.getElementById('xpdr-d3')
        ];

        this._bindEvents();
    }

    _bindEvents() {
        if (!this._modal) return;

        // Keypad digits
        this._modal.querySelectorAll('.xpdr-key[data-digit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onDigit(parseInt(btn.dataset.digit));
            });
        });

        // BACK
        const backBtn = document.getElementById('xpdr-back');
        if (backBtn) backBtn.addEventListener('click', (e) => { e.stopPropagation(); this._onBack(); });

        // ENTER
        const enterBtn = document.getElementById('xpdr-enter');
        if (enterBtn) enterBtn.addEventListener('click', (e) => { e.stopPropagation(); this._onEnter(); });

        // VFR
        const vfrBtn = document.getElementById('xpdr-vfr');
        if (vfrBtn) vfrBtn.addEventListener('click', (e) => { e.stopPropagation(); this._onVFR(); });

        // Mode buttons
        this._modal.querySelectorAll('.xpdr-mode-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onMode(parseInt(btn.dataset.mode));
            });
        });

        // IDENT button in modal
        const identBtn = document.getElementById('xpdr-modal-ident');
        if (identBtn) identBtn.addEventListener('click', (e) => { e.stopPropagation(); this._onIdent(); });

        // Click outside to close
        this._outsideHandler = (e) => {
            if (this._visible && this._modal && !this._modal.contains(e.target) && !e.target.closest('.xpdr-code') && !e.target.closest('.xpdr-ident')) {
                this.hide();
            }
        };
        document.addEventListener('click', this._outsideHandler);
    }

    show() {
        if (!this._modal) return;
        this._visible = true;
        this._modal.style.display = '';
        this._digitIdx = -1;
        this._updateDigitDisplay();
    }

    hide() {
        if (!this._modal) return;
        this._visible = false;
        this._modal.style.display = 'none';
        this._digitIdx = -1;
        this._updateDigitDisplay();
    }

    toggle() {
        if (this._visible) this.hide(); else this.show();
    }

    _onDigit(d) {
        if (this._digitIdx < 0) {
            // Start fresh entry
            this._digitIdx = 0;
            this._code = [d, -1, -1, -1];
        } else if (this._digitIdx < 3) {
            this._digitIdx++;
            this._code[this._digitIdx] = d;
        }
        this._updateDigitDisplay();
    }

    _onBack() {
        if (this._digitIdx >= 0) {
            this._code[this._digitIdx] = -1;
            this._digitIdx--;
            this._updateDigitDisplay();
        }
    }

    _onEnter() {
        // Only send if all 4 digits entered
        if (this._digitIdx === 3 && this._code.every(d => d >= 0)) {
            const codeStr = this._code.join('');
            this._sendCode(codeStr);
            this.hide();
        }
    }

    _onVFR() {
        this._code = [1, 2, 0, 0];
        this._digitIdx = -1;
        this._updateDigitDisplay();
        this._sendCode('1200');
        this.hide();
    }

    _onMode(state) {
        this._mode = state;
        this._sendMode(state);
        // Update active button
        this._modal.querySelectorAll('.xpdr-mode-btn[data-mode]').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.mode) === state);
        });
    }

    _onIdent() {
        this._identActive = !this._identActive;
        const identBtn = document.getElementById('xpdr-modal-ident');
        const topIdentBtn = document.getElementById('xpdr-ident');

        if (this._identActive) {
            if (identBtn) identBtn.classList.add('active');
            if (topIdentBtn) topIdentBtn.classList.add('active');
            this._sendIdent();
            // 18-second auto-off
            if (this._identTimer) clearTimeout(this._identTimer);
            this._identTimer = setTimeout(() => {
                this._identActive = false;
                if (identBtn) identBtn.classList.remove('active');
                if (topIdentBtn) topIdentBtn.classList.remove('active');
                this._identTimer = null;
            }, 18000);
        } else {
            if (identBtn) identBtn.classList.remove('active');
            if (topIdentBtn) topIdentBtn.classList.remove('active');
            if (this._identTimer) { clearTimeout(this._identTimer); this._identTimer = null; }
        }
    }

    _updateDigitDisplay() {
        for (let i = 0; i < 4; i++) {
            const el = this._digits[i];
            if (!el) continue;
            const val = this._code[i];
            el.textContent = val >= 0 ? val : '_';
            el.classList.toggle('active', i === this._digitIdx + 1 && this._digitIdx < 3 && this._digitIdx >= 0);
        }
        // Highlight current entry position
        if (this._digitIdx >= 0 && this._digitIdx <= 3) {
            this._digits.forEach((el, i) => {
                if (el) el.classList.toggle('active', i === this._digitIdx);
            });
        }
    }

    _sendCode(code) {
        fetch(`http://localhost:${this.serverPort}/api/radio/xpdr/xpndr_set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        }).catch(e => console.warn('[XPDR] Failed to set code:', e.message));
    }

    _sendMode(state) {
        fetch(`http://localhost:${this.serverPort}/api/radio/xpdr/xpndr_state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: String(state) })
        }).catch(e => console.warn('[XPDR] Failed to set mode:', e.message));
    }

    _sendIdent() {
        fetch(`http://localhost:${this.serverPort}/api/radio/xpdr/xpndr_ident`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).catch(e => console.warn('[XPDR] Failed to send ident:', e.message));
    }

    /**
     * Update from live flight data
     */
    update(data) {
        if (data.transponder !== undefined && this._digitIdx < 0) {
            const codeStr = String(data.transponder).padStart(4, '0');
            this._code = codeStr.split('').map(Number);
            this._updateDigitDisplay();
        }
        if (data.transponderState !== undefined) {
            this._mode = data.transponderState;
            if (this._modal) {
                this._modal.querySelectorAll('.xpdr-mode-btn[data-mode]').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.mode) === this._mode);
                });
            }
        }
        if (data.transponderIdent !== undefined) {
            const active = !!data.transponderIdent;
            if (active !== this._identActive) {
                this._identActive = active;
                const identBtn = document.getElementById('xpdr-modal-ident');
                const topIdentBtn = document.getElementById('xpdr-ident');
                if (identBtn) identBtn.classList.toggle('active', active);
                if (topIdentBtn) topIdentBtn.classList.toggle('active', active);
            }
        }
    }

    destroy() {
        this._destroyed = true;
        if (this._identTimer) { clearTimeout(this._identTimer); this._identTimer = null; }
        if (this._outsideHandler) document.removeEventListener('click', this._outsideHandler);
    }
}
