/**
 * Action Wheel v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Radial menu for TinyWidgets.
 */

class ActionWheel {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.loader = options.loader;
        this.api = options.api;
        this.flightData = {};
        
        this.isOpen = false;
        this.activeCategory = null;
        this.wheelEl = null;
        this.radius = options.radius || 120;
        
        this.createWheel();
    }
    
    createWheel() {
        // Create wheel container
        this.wheelEl = document.createElement('div');
        this.wheelEl.className = 'action-wheel hidden';
        this.wheelEl.innerHTML = `
            <div class="wheel-backdrop"></div>
            <div class="wheel-container">
                <div class="wheel-center">
                    <span class="wheel-title">Actions</span>
                </div>
                <div class="wheel-categories"></div>
                <div class="wheel-items"></div>
            </div>
        `;
        
        this.container.appendChild(this.wheelEl);
        
        // Bind events
        this.wheelEl.querySelector('.wheel-backdrop').addEventListener('click', () => this.close());
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }
    
    /**
     * Render category buttons in inner ring
     */
    renderCategories() {
        const categoriesEl = this.wheelEl.querySelector('.wheel-categories');
        categoriesEl.innerHTML = '';
        
        const categories = this.loader.getCategoriesWithWidgets();
        const angleStep = 360 / categories.length;
        
        categories.forEach((cat, i) => {
            const angle = i * angleStep - 90; // Start from top
            const btn = document.createElement('button');
            btn.className = 'wheel-cat-btn';
            btn.dataset.category = cat.id;
            btn.innerHTML = `<span class="cat-icon">${cat.icon}</span>`;
            btn.title = cat.name;
            btn.style.setProperty('--angle', `${angle}deg`);
            btn.style.setProperty('--color', cat.color);
            
            btn.addEventListener('click', () => this.selectCategory(cat.id));
            categoriesEl.appendChild(btn);
        });
    }
    
    /**
     * Select category and show its widgets
     */
    selectCategory(categoryId) {
        this.activeCategory = categoryId;
        
        // Update active state
        this.wheelEl.querySelectorAll('.wheel-cat-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === categoryId);
        });
        
        // Render widgets for this category
        this.renderWidgets(categoryId);
    }
    
    /**
     * Render widget buttons in outer ring
     */
    renderWidgets(categoryId) {
        const itemsEl = this.wheelEl.querySelector('.wheel-items');
        itemsEl.innerHTML = '';
        
        const widgets = this.loader.getByCategory(categoryId);
        const angleStep = 360 / Math.max(widgets.length, 1);
        
        widgets.forEach((widget, i) => {
            const angle = i * angleStep - 90;
            const btn = document.createElement('button');
            btn.className = 'wheel-item-btn';
            btn.dataset.widget = widget.id;
            btn.innerHTML = `
                <span class="item-icon">${widget.icon}</span>
                <span class="item-label">${widget.name}</span>
                <span class="item-led ${widget.state.active ? 'active' : ''}"></span>
            `;
            btn.title = widget.description;
            btn.style.setProperty('--angle', `${angle}deg`);
            btn.style.setProperty('--color', widget.color);
            
            if (widget.state.active) {
                btn.classList.add('active');
            }
            
            btn.addEventListener('click', () => this.executeWidget(widget.id));
            itemsEl.appendChild(btn);
        });
    }
    
    /**
     * Execute widget action
     */
    executeWidget(widgetId) {
        const newState = this.loader.execute(widgetId, this.api, this.flightData);
        
        // Update button state
        const btn = this.wheelEl.querySelector(`[data-widget="${widgetId}"]`);
        if (btn && newState) {
            btn.classList.toggle('active', newState.active);
            btn.querySelector('.item-led')?.classList.toggle('active', newState.active);
            
            if (newState.flash) {
                btn.classList.add('flash');
                setTimeout(() => btn.classList.remove('flash'), 200);
            }
        }
    }
    
    /**
     * Update flight data and widget states
     */
    updateFlightData(data) {
        this.flightData = data;
        this.loader.updateStates(data);
        
        // Update displayed buttons
        if (this.isOpen && this.activeCategory) {
            this.renderWidgets(this.activeCategory);
        }
    }
    
    /**
     * Open the wheel
     */
    open(x, y) {
        this.renderCategories();
        
        // Position wheel
        const container = this.wheelEl.querySelector('.wheel-container');
        if (x !== undefined && y !== undefined) {
            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
        } else {
            container.style.left = '50%';
            container.style.top = '50%';
        }
        
        this.wheelEl.classList.remove('hidden');
        this.isOpen = true;
        
        // Select first category
        const categories = this.loader.getCategoriesWithWidgets();
        if (categories.length > 0) {
            this.selectCategory(categories[0].id);
        }
    }
    
    /**
     * Close the wheel
     */
    close() {
        this.wheelEl.classList.add('hidden');
        this.isOpen = false;
        this.activeCategory = null;
    }
    
    /**
     * Toggle wheel
     */
    toggle(x, y) {
        if (this.isOpen) {
            this.close();
        } else {
            this.open(x, y);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionWheel;
}
