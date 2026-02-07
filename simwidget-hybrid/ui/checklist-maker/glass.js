/**
 * Checklist Maker - SimGlass v2.0.0
 * Create and edit custom aircraft checklists
 */

class ChecklistMaker extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'checklist-maker',
            widgetVersion: '2.0.0',
            autoConnect: false  // Local checklist editing, no WebSocket
        });

        this.customChecklists = {};
        this.selectedAircraft = null;
        this.selectedPhase = null;

        this.phaseIcons = {
            preflight: '🔍',
            startup: '🔑',
            taxi: '🛞',
            takeoff: '🛫',
            climb: '📈',
            cruise: '✈️',
            descent: '📉',
            approach: '🎯',
            landing: '🛬',
            shutdown: '🔒',
            emergency: '🚨',
            custom: '📋'
        };

        this.defaultPhases = [
            { id: 'preflight', name: 'Pre-Flight' },
            { id: 'startup', name: 'Engine Start' },
            { id: 'taxi', name: 'Taxi' },
            { id: 'takeoff', name: 'Before Takeoff' },
            { id: 'cruise', name: 'Cruise' },
            { id: 'landing', name: 'Before Landing' },
            { id: 'shutdown', name: 'Shutdown' }
        ];

        this.loadState();
        this.initControls();
        this.renderAircraftList();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('custom-checklists');
            if (saved) {
                this.customChecklists = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[ChecklistMaker] Failed to load:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('custom-checklists', JSON.stringify(this.customChecklists));
            // Notify checklist glass of update
            const channel = new BroadcastChannel('SimGlass-checklists');
            channel.postMessage({ type: 'checklists-updated', data: this.customChecklists });
            channel.close();
        } catch (e) {
            console.error('[ChecklistMaker] Failed to save:', e);
        }
    }

    initControls() {
        // New aircraft button
        document.getElementById('btn-new-aircraft').addEventListener('click', () => {
            this.showAircraftModal();
        });

        // New phase button
        document.getElementById('btn-new-phase').addEventListener('click', () => {
            this.showPhaseModal();
        });

        // New item button
        document.getElementById('btn-new-item').addEventListener('click', () => {
            this.showItemModal();
        });

        // Export/Import
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportChecklists();
        });

        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importChecklists(e.target.files[0]);
            }
        });

        // Modal controls
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
    }

    createEmptyState(icon, text) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';

        const iconEl = document.createElement('div');
        iconEl.className = 'empty-icon';
        iconEl.textContent = icon;

        const textEl = document.createElement('div');
        textEl.className = 'empty-text';
        textEl.textContent = text;

        empty.appendChild(iconEl);
        empty.appendChild(textEl);
        return empty;
    }

    // Aircraft Management
    renderAircraftList() {
        const container = document.getElementById('aircraft-list');
        container.replaceChildren();

        const aircraftIds = Object.keys(this.customChecklists);

        if (aircraftIds.length === 0) {
            container.appendChild(this.createEmptyState('✈️', 'No custom aircraft yet. Click "+ New Aircraft" to create one.'));
            return;
        }

        aircraftIds.forEach(id => {
            const aircraft = this.customChecklists[id];
            const item = this.createAircraftItem(id, aircraft);
            container.appendChild(item);
        });
    }

    createAircraftItem(id, aircraft) {
        const item = document.createElement('div');
        item.className = 'aircraft-item' + (this.selectedAircraft === id ? ' selected' : '');

        const icon = document.createElement('span');
        icon.className = 'item-icon';
        icon.textContent = '✈️';

        const info = document.createElement('div');
        info.className = 'item-info';

        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = aircraft.name;

        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const phaseCount = Object.keys(aircraft.checklists || {}).length;
        meta.textContent = phaseCount + ' phases';

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action';
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAircraftModal(id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action delete';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteAircraft(id);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(actions);

        item.addEventListener('click', () => {
            this.selectAircraft(id);
        });

        return item;
    }

    selectAircraft(id) {
        this.selectedAircraft = id;
        this.selectedPhase = null;
        this.renderAircraftList();
        this.renderPhaseList();
        document.getElementById('phases-section').style.display = 'block';
        document.getElementById('items-section').style.display = 'none';
    }

    showAircraftModal(editId = null) {
        const isEdit = editId !== null;
        const aircraft = isEdit ? this.customChecklists[editId] : null;

        document.getElementById('modal-title').textContent = isEdit ? 'Edit Aircraft' : 'New Aircraft';

        const body = document.getElementById('modal-body');
        body.replaceChildren();

        // Name field
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.className = 'form-label';
        nameLabel.textContent = 'Aircraft Name';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-input';
        nameInput.id = 'aircraft-name';
        nameInput.placeholder = 'e.g., Piper PA-28 Cherokee';
        if (isEdit) nameInput.value = aircraft.name;
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        body.appendChild(nameGroup);

        // ID field (only for new)
        if (!isEdit) {
            const idGroup = document.createElement('div');
            idGroup.className = 'form-group';
            const idLabel = document.createElement('label');
            idLabel.className = 'form-label';
            idLabel.textContent = 'Short ID (no spaces)';
            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.className = 'form-input';
            idInput.id = 'aircraft-id';
            idInput.placeholder = 'e.g., pa28';
            idInput.style.textTransform = 'lowercase';
            idGroup.appendChild(idLabel);
            idGroup.appendChild(idInput);
            body.appendChild(idGroup);
        }

        // Save handler
        const saveBtn = document.getElementById('modal-save');
        saveBtn.onclick = () => {
            const name = document.getElementById('aircraft-name').value.trim();
            const id = isEdit ? editId : document.getElementById('aircraft-id').value.trim().toLowerCase().replace(/\s+/g, '-');

            if (!name) {
                alert('Please enter an aircraft name');
                return;
            }

            if (!isEdit && !id) {
                alert('Please enter an ID');
                return;
            }

            if (!isEdit && this.customChecklists[id]) {
                alert('An aircraft with this ID already exists');
                return;
            }

            if (isEdit) {
                this.customChecklists[id].name = name;
            } else {
                this.customChecklists[id] = {
                    name: name,
                    checklists: {}
                };
                // Add default phases
                this.defaultPhases.forEach(phase => {
                    this.customChecklists[id].checklists[phase.id] = {
                        name: phase.name,
                        items: []
                    };
                });
            }

            this.saveState();
            this.renderAircraftList();
            this.closeModal();

            if (!isEdit) {
                this.selectAircraft(id);
            }
        };

        this.openModal();
    }

    deleteAircraft(id) {
        if (!confirm('Delete "' + this.customChecklists[id].name + '"? This cannot be undone.')) {
            return;
        }

        delete this.customChecklists[id];
        this.saveState();

        if (this.selectedAircraft === id) {
            this.selectedAircraft = null;
            document.getElementById('phases-section').style.display = 'none';
            document.getElementById('items-section').style.display = 'none';
        }

        this.renderAircraftList();
    }

    // Phase Management
    renderPhaseList() {
        const container = document.getElementById('phase-list');
        container.replaceChildren();

        if (!this.selectedAircraft) return;

        const aircraft = this.customChecklists[this.selectedAircraft];
        const phases = aircraft.checklists || {};
        const phaseIds = Object.keys(phases);

        if (phaseIds.length === 0) {
            container.appendChild(this.createEmptyState('📋', 'No phases yet. Click "+ Add Phase" to create one.'));
            return;
        }

        phaseIds.forEach(id => {
            const phase = phases[id];
            const item = this.createPhaseItem(id, phase);
            container.appendChild(item);
        });
    }

    createPhaseItem(id, phase) {
        const item = document.createElement('div');
        item.className = 'phase-item' + (this.selectedPhase === id ? ' selected' : '');

        const icon = document.createElement('span');
        icon.className = 'phase-icon';
        icon.textContent = this.phaseIcons[id] || this.phaseIcons.custom;

        const info = document.createElement('div');
        info.className = 'item-info';

        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = phase.name;

        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const itemCount = (phase.items || []).length;
        meta.textContent = itemCount + ' items';

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action';
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPhaseModal(id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action delete';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deletePhase(id);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(actions);

        item.addEventListener('click', () => {
            this.selectPhase(id);
        });

        return item;
    }

    selectPhase(id) {
        this.selectedPhase = id;
        this.renderPhaseList();
        this.renderItemsList();
        document.getElementById('items-section').style.display = 'block';

        const phase = this.customChecklists[this.selectedAircraft].checklists[id];
        document.getElementById('items-title').textContent = phase.name + ' Items';
    }

    showPhaseModal(editId = null) {
        const isEdit = editId !== null;
        const phase = isEdit ? this.customChecklists[this.selectedAircraft].checklists[editId] : null;

        document.getElementById('modal-title').textContent = isEdit ? 'Edit Phase' : 'New Phase';

        const body = document.getElementById('modal-body');
        body.replaceChildren();

        // Name field
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.className = 'form-label';
        nameLabel.textContent = 'Phase Name';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-input';
        nameInput.id = 'phase-name';
        nameInput.placeholder = 'e.g., Before Takeoff';
        if (isEdit) nameInput.value = phase.name;
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        body.appendChild(nameGroup);

        // ID field (only for new)
        if (!isEdit) {
            const idGroup = document.createElement('div');
            idGroup.className = 'form-group';
            const idLabel = document.createElement('label');
            idLabel.className = 'form-label';
            idLabel.textContent = 'Phase ID (no spaces)';
            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.className = 'form-input';
            idInput.id = 'phase-id';
            idInput.placeholder = 'e.g., before-takeoff';
            idInput.style.textTransform = 'lowercase';
            idGroup.appendChild(idLabel);
            idGroup.appendChild(idInput);
            body.appendChild(idGroup);
        }

        // Save handler
        const saveBtn = document.getElementById('modal-save');
        saveBtn.onclick = () => {
            const name = document.getElementById('phase-name').value.trim();
            const id = isEdit ? editId : document.getElementById('phase-id').value.trim().toLowerCase().replace(/\s+/g, '-');

            if (!name) {
                alert('Please enter a phase name');
                return;
            }

            if (!isEdit && !id) {
                alert('Please enter an ID');
                return;
            }

            const aircraft = this.customChecklists[this.selectedAircraft];

            if (!isEdit && aircraft.checklists[id]) {
                alert('A phase with this ID already exists');
                return;
            }

            if (isEdit) {
                aircraft.checklists[id].name = name;
            } else {
                aircraft.checklists[id] = {
                    name: name,
                    items: []
                };
            }

            this.saveState();
            this.renderPhaseList();
            this.closeModal();

            if (!isEdit) {
                this.selectPhase(id);
            }
        };

        this.openModal();
    }

    deletePhase(id) {
        const phase = this.customChecklists[this.selectedAircraft].checklists[id];
        if (!confirm('Delete "' + phase.name + '"? This cannot be undone.')) {
            return;
        }

        delete this.customChecklists[this.selectedAircraft].checklists[id];
        this.saveState();

        if (this.selectedPhase === id) {
            this.selectedPhase = null;
            document.getElementById('items-section').style.display = 'none';
        }

        this.renderPhaseList();
    }

    // Items Management
    renderItemsList() {
        const container = document.getElementById('items-list');
        container.replaceChildren();

        if (!this.selectedAircraft || !this.selectedPhase) return;

        const phase = this.customChecklists[this.selectedAircraft].checklists[this.selectedPhase];
        const items = phase.items || [];

        if (items.length === 0) {
            container.appendChild(this.createEmptyState('📝', 'No items yet. Click "+ Add Item" to create one.'));
            return;
        }

        items.forEach((item, index) => {
            const el = this.createItemElement(item, index);
            container.appendChild(el);
        });
    }

    createItemElement(item, index) {
        const el = document.createElement('div');
        el.className = 'checklist-item-edit';

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⋮⋮';

        const content = document.createElement('div');
        content.className = 'item-content';

        const text = document.createElement('span');
        text.className = 'item-text';
        text.textContent = item.text;

        const action = document.createElement('span');
        action.className = 'item-action-text';
        action.textContent = item.action;

        content.appendChild(text);
        content.appendChild(action);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action';
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', () => {
            this.showItemModal(index);
        });

        const upBtn = document.createElement('button');
        upBtn.className = 'btn-action';
        upBtn.textContent = '↑';
        upBtn.title = 'Move Up';
        upBtn.addEventListener('click', () => {
            this.moveItem(index, -1);
        });

        const downBtn = document.createElement('button');
        downBtn.className = 'btn-action';
        downBtn.textContent = '↓';
        downBtn.title = 'Move Down';
        downBtn.addEventListener('click', () => {
            this.moveItem(index, 1);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action delete';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', () => {
            this.deleteItem(index);
        });

        actions.appendChild(editBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(deleteBtn);

        el.appendChild(handle);
        el.appendChild(content);
        el.appendChild(actions);

        return el;
    }

    showItemModal(editIndex = null) {
        const isEdit = editIndex !== null;
        const phase = this.customChecklists[this.selectedAircraft].checklists[this.selectedPhase];
        const item = isEdit ? phase.items[editIndex] : null;

        document.getElementById('modal-title').textContent = isEdit ? 'Edit Item' : 'New Item';

        const body = document.getElementById('modal-body');
        body.replaceChildren();

        // Text field
        const textGroup = document.createElement('div');
        textGroup.className = 'form-group';
        const textLabel = document.createElement('label');
        textLabel.className = 'form-label';
        textLabel.textContent = 'Item Text';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'form-input';
        textInput.id = 'item-text';
        textInput.placeholder = 'e.g., Fuel Selector';
        if (isEdit) textInput.value = item.text;
        textGroup.appendChild(textLabel);
        textGroup.appendChild(textInput);
        body.appendChild(textGroup);

        // Action field
        const actionGroup = document.createElement('div');
        actionGroup.className = 'form-group';
        const actionLabel = document.createElement('label');
        actionLabel.className = 'form-label';
        actionLabel.textContent = 'Action / Setting';
        const actionInput = document.createElement('input');
        actionInput.type = 'text';
        actionInput.className = 'form-input';
        actionInput.id = 'item-action';
        actionInput.placeholder = 'e.g., BOTH';
        if (isEdit) actionInput.value = item.action;
        actionGroup.appendChild(actionLabel);
        actionGroup.appendChild(actionInput);
        body.appendChild(actionGroup);

        // Save handler
        const saveBtn = document.getElementById('modal-save');
        saveBtn.onclick = () => {
            const text = document.getElementById('item-text').value.trim();
            const action = document.getElementById('item-action').value.trim();

            if (!text) {
                alert('Please enter item text');
                return;
            }

            if (!action) {
                alert('Please enter an action');
                return;
            }

            if (isEdit) {
                phase.items[editIndex] = { text, action };
            } else {
                phase.items.push({ text, action });
            }

            this.saveState();
            this.renderItemsList();
            this.renderPhaseList(); // Update item count
            this.closeModal();
        };

        this.openModal();
    }

    moveItem(index, direction) {
        const phase = this.customChecklists[this.selectedAircraft].checklists[this.selectedPhase];
        const items = phase.items;
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= items.length) return;

        const temp = items[index];
        items[index] = items[newIndex];
        items[newIndex] = temp;

        this.saveState();
        this.renderItemsList();
    }

    deleteItem(index) {
        const phase = this.customChecklists[this.selectedAircraft].checklists[this.selectedPhase];

        if (!confirm('Delete this item?')) return;

        phase.items.splice(index, 1);
        this.saveState();
        this.renderItemsList();
        this.renderPhaseList(); // Update item count
    }

    // Export/Import
    exportChecklists() {
        const data = JSON.stringify(this.customChecklists, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'custom-checklists-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async importChecklists(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate structure
            for (const [id, aircraft] of Object.entries(data)) {
                if (!aircraft.name || !aircraft.checklists) {
                    throw new Error('Invalid checklist format');
                }
            }

            // Merge with existing
            const merge = confirm('Merge with existing checklists? (Cancel to replace all)');

            if (merge) {
                Object.assign(this.customChecklists, data);
            } else {
                this.customChecklists = data;
            }

            this.saveState();
            this.renderAircraftList();
            alert('Imported ' + Object.keys(data).length + ' aircraft checklists');

        } catch (e) {
            alert('Error importing: ' + e.message);
        }
    }

    // Modal helpers
    openModal() {
        document.getElementById('modal-overlay').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.checklistMaker = new ChecklistMaker();
    window.addEventListener('beforeunload', () => window.checklistMaker?.destroy());
});
