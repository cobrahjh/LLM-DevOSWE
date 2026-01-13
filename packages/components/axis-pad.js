/**
 * SimWidget AxisPad Component
 * Version: v1.0.0
 * Last Updated: 2025-01-05
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\packages\components\axis-pad.js
 * 
 * A 2-axis joystick-style input control for flight controls.
 * Maps horizontal movement to aileron and vertical to elevator.
 */

class SWAxisPad {
    constructor(container, config = {}) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        // Configuration with defaults
        this.config = {
            id: config.id || 'axis-pad-' + Date.now(),
            width: config.width || 150,
            height: config.height || 150,
            label: config.label || 'Flight Controls',
            
            // X-axis config
            xAxis: {
                simvar: config.xAxis?.simvar || 'A:YOKE X POSITION',
                unit: config.xAxis?.unit || 'position',
                command: config.xAxis?.command || 'AXIS_AILERONS_SET',
                min: config.xAxis?.min ?? -16383,
                max: config.xAxis?.max ?? 16383,
                deadzone: config.xAxis?.deadzone ?? 0.05,
                sensitivity: config.xAxis?.sensitivity ?? 1.0,
                inverted: config.xAxis?.inverted ?? false
            },
            
            // Y-axis config
            yAxis: {
                simvar: config.yAxis?.simvar || 'A:YOKE Y POSITION',
                unit: config.yAxis?.unit || 'position',
                command: config.yAxis?.command || 'AXIS_ELEVATOR_SET',
                min: config.yAxis?.min ?? -16383,
                max: config.yAxis?.max ?? 16383,
                deadzone: config.yAxis?.deadzone ?? 0.05,
                sensitivity: config.yAxis?.sensitivity ?? 1.0,
                inverted: config.yAxis?.inverted ?? false
            },
            
            // Visual options
            style: config.style || 'round',
            showGrid: config.showGrid !== false,
            showCrosshair: config.showCrosshair !== false,
            showValues: config.showValues !== false,
            returnToCenter: config.returnToCenter !== false,
            springStrength: config.springStrength ?? 0.15,
            
            // Callbacks
            onChange: config.onChange || null,
            onRelease: config.onRelease || null
        };
        
        // State
        this.state = {
            x: 0,  // -1 to 1
            y: 0,  // -1 to 1
            isDragging: false,
            isActive: false
        };
        
        // Elements
        this.element = null;
        this.knobEl = null;
        this.xValueEl = null;
        this.yValueEl = null;
        
        // Animation
        this.animationId = null;
        
        this.render();
        this.setupEvents();
    }
    
    render() {
        const { width, height, style, showGrid, showCrosshair, showValues, label } = this.config;
        const knobSize = Math.min(width, height) * 0.25;
        
        this.element = document.createElement('div');
        this.element.className = 'swc-axis-pad';
        this.element.id = this.config.id;
        this.element.innerHTML = `
            <div class="swc-axis-pad__label">${label}</div>
            <div class="swc-axis-pad__track" style="width:${width}px;height:${height}px;">
                ${showGrid ? this.renderGrid() : ''}
                ${showCrosshair ? this.renderCrosshair() : ''}
                <div class="swc-axis-pad__center"></div>
                <div class="swc-axis-pad__knob" style="width:${knobSize}px;height:${knobSize}px;"></div>
            </div>
            ${showValues ? `
                <div class="swc-axis-pad__values">
                    <span class="swc-axis-pad__value-x">X: 0</span>
                    <span class="swc-axis-pad__value-y">Y: 0</span>
                </div>
            ` : ''}
        `;
        
        // Store references
        this.knobEl = this.element.querySelector('.swc-axis-pad__knob');
        this.trackEl = this.element.querySelector('.swc-axis-pad__track');
        this.xValueEl = this.element.querySelector('.swc-axis-pad__value-x');
        this.yValueEl = this.element.querySelector('.swc-axis-pad__value-y');
        
        // Apply style class
        this.element.classList.add(`swc-axis-pad--${style}`);
        
        // Append to container
        if (this.container) {
            this.container.appendChild(this.element);
        }
        
        // Initial knob position (center)
        this.updateKnobPosition();
    }
    
    renderGrid() {
        return `
            <svg class="swc-axis-pad__grid" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(255,255,255,0.1)" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.2)" />
                <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(255,255,255,0.1)" />
                <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.2)" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" />
            </svg>
        `;
    }
    
    renderCrosshair() {
        return `
            <div class="swc-axis-pad__crosshair swc-axis-pad__crosshair--h"></div>
            <div class="swc-axis-pad__crosshair swc-axis-pad__crosshair--v"></div>
        `;
    }

    setupEvents() {
        // Prevent context menu
        this.trackEl.addEventListener('contextmenu', e => e.preventDefault());
        
        // Mouse events
        this.trackEl.addEventListener('mousedown', this.onDragStart.bind(this));
        document.addEventListener('mousemove', this.onDragMove.bind(this));
        document.addEventListener('mouseup', this.onDragEnd.bind(this));
        
        // Touch events
        this.trackEl.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Keyboard events (when focused)
        this.element.setAttribute('tabindex', '0');
        this.element.addEventListener('keydown', this.onKeyDown.bind(this));
        this.element.addEventListener('keyup', this.onKeyUp.bind(this));
    }
    
    onDragStart(e) {
        e.preventDefault();
        this.state.isDragging = true;
        this.element.classList.add('swc-axis-pad--dragging');
        this.updateFromEvent(e);
    }
    
    onDragMove(e) {
        if (!this.state.isDragging) return;
        e.preventDefault();
        this.updateFromEvent(e);
    }
    
    onDragEnd(e) {
        if (!this.state.isDragging) return;
        this.state.isDragging = false;
        this.element.classList.remove('swc-axis-pad--dragging');
        
        if (this.config.returnToCenter) {
            this.animateToCenter();
        }
        
        if (this.config.onRelease) {
            this.config.onRelease(this.state.x, this.state.y);
        }
    }
    
    onTouchStart(e) {
        e.preventDefault();
        this.state.isDragging = true;
        this.element.classList.add('swc-axis-pad--dragging');
        if (e.touches.length > 0) {
            this.updateFromTouch(e.touches[0]);
        }
    }
    
    onTouchMove(e) {
        if (!this.state.isDragging) return;
        e.preventDefault();
        if (e.touches.length > 0) {
            this.updateFromTouch(e.touches[0]);
        }
    }
    
    onTouchEnd(e) {
        this.onDragEnd(e);
    }
    
    onKeyDown(e) {
        const step = 0.1;
        let changed = false;
        
        switch (e.key) {
            case 'ArrowLeft':
                this.state.x = Math.max(-1, this.state.x - step);
                changed = true;
                break;
            case 'ArrowRight':
                this.state.x = Math.min(1, this.state.x + step);
                changed = true;
                break;
            case 'ArrowUp':
                this.state.y = Math.max(-1, this.state.y - step);
                changed = true;
                break;
            case 'ArrowDown':
                this.state.y = Math.min(1, this.state.y + step);
                changed = true;
                break;
            case ' ':
            case 'Escape':
                this.state.x = 0;
                this.state.y = 0;
                changed = true;
                break;
        }
        
        if (changed) {
            e.preventDefault();
            this.updateKnobPosition();
            this.emitChange();
        }
    }
    
    onKeyUp(e) {
        if (this.config.returnToCenter && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            this.animateToCenter();
        }
    }
    
    updateFromEvent(e) {
        const rect = this.trackEl.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        this.setPosition(x * 2 - 1, y * 2 - 1);
    }
    
    updateFromTouch(touch) {
        const rect = this.trackEl.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;
        this.setPosition(x * 2 - 1, y * 2 - 1);
    }
    
    setPosition(x, y) {
        // Clamp to -1 to 1
        x = Math.max(-1, Math.min(1, x));
        y = Math.max(-1, Math.min(1, y));
        
        // Apply inversions
        if (this.config.xAxis.inverted) x = -x;
        if (this.config.yAxis.inverted) y = -y;
        
        // Apply deadzone
        if (Math.abs(x) < this.config.xAxis.deadzone) x = 0;
        if (Math.abs(y) < this.config.yAxis.deadzone) y = 0;
        
        // Apply sensitivity
        x *= this.config.xAxis.sensitivity;
        y *= this.config.yAxis.sensitivity;
        
        // Clamp again after sensitivity
        x = Math.max(-1, Math.min(1, x));
        y = Math.max(-1, Math.min(1, y));
        
        this.state.x = x;
        this.state.y = y;
        
        this.updateKnobPosition();
        this.emitChange();
    }
    
    updateKnobPosition() {
        if (!this.knobEl) return;
        
        const rect = this.trackEl.getBoundingClientRect();
        const knobSize = this.knobEl.offsetWidth;
        const maxX = rect.width - knobSize;
        const maxY = rect.height - knobSize;
        
        // Convert -1 to 1 range to pixel position
        const px = ((this.state.x + 1) / 2) * maxX;
        const py = ((this.state.y + 1) / 2) * maxY;
        
        this.knobEl.style.transform = `translate(${px}px, ${py}px)`;
        
        // Update value displays
        if (this.xValueEl) {
            this.xValueEl.textContent = `X: ${(this.state.x * 100).toFixed(0)}%`;
        }
        if (this.yValueEl) {
            this.yValueEl.textContent = `Y: ${(this.state.y * 100).toFixed(0)}%`;
        }
    }
    
    animateToCenter() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        const animate = () => {
            const spring = this.config.springStrength;
            
            this.state.x *= (1 - spring);
            this.state.y *= (1 - spring);
            
            // Snap to zero when close enough
            if (Math.abs(this.state.x) < 0.01) this.state.x = 0;
            if (Math.abs(this.state.y) < 0.01) this.state.y = 0;
            
            this.updateKnobPosition();
            this.emitChange();
            
            if (this.state.x !== 0 || this.state.y !== 0) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.animationId = null;
            }
        };
        
        this.animationId = requestAnimationFrame(animate);
    }

    emitChange() {
        if (this.config.onChange) {
            this.config.onChange({
                x: this.state.x,
                y: this.state.y,
                xCommand: this.config.xAxis.command,
                yCommand: this.config.yAxis.command,
                xValue: this.getCommandValue('x'),
                yValue: this.getCommandValue('y')
            });
        }
    }
    
    getCommandValue(axis) {
        const cfg = axis === 'x' ? this.config.xAxis : this.config.yAxis;
        const val = axis === 'x' ? this.state.x : this.state.y;
        
        // Map -1 to 1 range to SimConnect range (usually -16383 to 16383)
        return Math.round(val * cfg.max);
    }
    
    // Public API
    getValue() {
        return {
            x: this.state.x,
            y: this.state.y,
            xPercent: this.state.x * 100,
            yPercent: this.state.y * 100
        };
    }
    
    setValue(x, y) {
        this.setPosition(x, y);
    }
    
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (enabled) {
            this.element.classList.remove('swc-axis-pad--disabled');
        } else {
            this.element.classList.add('swc-axis-pad--disabled');
        }
    }
    
    reset() {
        this.state.x = 0;
        this.state.y = 0;
        this.updateKnobPosition();
        this.emitChange();
    }
    
    // Update from SimConnect (for visual feedback)
    updateFromSimvar(xValue, yValue) {
        // Convert SimConnect range to -1 to 1
        this.state.x = xValue / this.config.xAxis.max;
        this.state.y = yValue / this.config.yAxis.max;
        this.updateKnobPosition();
    }
    
    // Serialization
    toJSON() {
        return {
            type: 'AxisPad',
            id: this.config.id,
            config: this.config
        };
    }
    
    static fromJSON(json, container) {
        return new SWAxisPad(container, json.config);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SWAxisPad;
}
if (typeof window !== 'undefined') {
    window.SWAxisPad = SWAxisPad;
}
