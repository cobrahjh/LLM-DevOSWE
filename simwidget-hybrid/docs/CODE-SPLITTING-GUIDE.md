# Code Splitting Guide - SimGlass

Best practices and patterns for implementing lazy-loading in SimGlass widgets.

## When to Use Code Splitting

### Good Candidates ✅

**Large data structures** (>300 lines):
- Aircraft databases (checklists, performance data)
- Emergency procedure libraries
- Command/phrase dictionaries
- Chart/map tile definitions
- Configuration presets

**Mode-specific features**:
- Features only used in certain widget modes
- Optional overlays or visualizations
- Advanced settings panels
- Plugin extensions

**Conditional dependencies**:
- Provider-specific APIs (OpenAI vs Anthropic)
- Platform-specific code (Windows vs browser)
- Feature flags or tier-based features

### Poor Candidates ❌

**Small files** (<200 lines):
- Not worth the overhead of dynamic loading
- Network latency > parse time savings

**Critical path code**:
- Core widget functionality needed immediately
- Base class dependencies
- Initial render logic

**Frequently accessed**:
- Data accessed on every render
- Utilities called in hot loops
- Event handlers

## Implementation Patterns

### Pattern 1: Category-Based Splitting (Checklist Widget)

**Use when**: Large dataset can be grouped into logical categories

**Structure**:
```
widget/
├── pane.js (main logic)
├── data/
│   ├── registry.js (maps items to categories)
│   ├── category-a.js (subset 1)
│   ├── category-b.js (subset 2)
│   └── category-c.js (subset 3)
```

**Registry** (data/registry.js):
```javascript
const ITEM_REGISTRY = {
    item1: { category: 'a', name: 'Item 1' },
    item2: { category: 'a', name: 'Item 2' },
    item3: { category: 'b', name: 'Item 3' }
};

const CATEGORY_FILES = {
    a: 'data/category-a.js',
    b: 'data/category-b.js',
    c: 'data/category-c.js'
};

async function loadItemData(itemId) {
    const { category } = ITEM_REGISTRY[itemId];
    if (!loadedCategories.has(category)) {
        await loadScript(CATEGORY_FILES[category]);
        loadedCategories.add(category);
    }
    return ITEM_DATA[itemId];
}
```

**Category file** (data/category-a.js):
```javascript
// Populate global object (defined as empty in pane.js)
Object.assign(ITEM_DATA, {
    item1: { /* data */ },
    item2: { /* data */ }
});
```

**Widget** (pane.js):
```javascript
const ITEM_DATA = {}; // Empty, populated by category files

class Widget extends SimGlassBase {
    async selectItem(itemId) {
        await loadItemData(itemId);
        this.render(ITEM_DATA[itemId]);
    }
}
```

### Pattern 2: Mode-Based Splitting (Copilot Widget)

**Use when**: Widget has distinct modes with separate data needs

**Structure**:
```
widget/
├── pane.js (core + mode switching)
├── data/
│   ├── data-loader.js (loading utility)
│   ├── mode-a-data.js (loaded when mode A active)
│   └── mode-b-data.js (loaded when mode B active)
```

**Loader** (data/data-loader.js):
```javascript
const loadedModules = new Set();

async function loadModuleData(moduleName) {
    if (loadedModules.has(moduleName)) return;
    await loadScript(`data/${moduleName}.js`);
    loadedModules.add(moduleName);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
    });
}
```

**Widget** (pane.js):
```javascript
const MODE_A_DATA = {};
const MODE_B_DATA = {};

class Widget extends SimGlassBase {
    async switchMode(mode) {
        if (mode === 'a') {
            await loadModuleData('mode-a-data');
            this.renderModeA(MODE_A_DATA);
        } else if (mode === 'b') {
            await loadModuleData('mode-b-data');
            this.renderModeB(MODE_B_DATA);
        }
    }
}
```

### Pattern 3: Feature-Based Splitting (GTN750)

**Use when**: Widget has optional features or pages

**Structure**:
```
widget/
├── pane.js (core functionality)
├── modules/
│   ├── module-loader.js (dynamic loader)
│   ├── core-module.js (always loaded)
│   ├── feature-a.js (lazy)
│   └── feature-b.js (lazy)
```

**See**: `ui/gtn750/` for full implementation with ModuleLoader utility.

## Best Practices

### 1. Empty Object Pattern
```javascript
// In main pane.js
const DATA = {}; // Will be populated by lazy modules

// In data module
Object.assign(DATA, {
    key1: value1,
    key2: value2
});
```

**Why**: Avoids const redefinition errors, allows global state sharing.

### 2. Loading Indicators
```javascript
async loadData() {
    this.showLoadingSpinner();
    try {
        await loadScript('data/module.js');
    } finally {
        this.hideLoadingSpinner();
    }
}
```

**Why**: Provides user feedback for network delays.

### 3. Error Handling
```javascript
async loadData() {
    try {
        await loadScript('data/module.js');
    } catch (err) {
        console.error('Load failed:', err);
        window.telemetry?.captureError?.(err, { context: 'lazy-load' });
        this.fallbackToDefaults();
    }
}
```

**Why**: Graceful degradation on network errors.

### 4. Concurrent Load Prevention
```javascript
let loading = false;

async loadData() {
    if (loading) return;
    loading = true;
    try {
        await loadScript('data/module.js');
    } finally {
        loading = false;
    }
}
```

**Why**: Prevents duplicate script tags from race conditions.

### 5. Preloading (Optional)
```javascript
// In idle callback or after initial render
requestIdleCallback(() => {
    preloadCategory('next-likely-category');
});
```

**Why**: Reduces perceived latency for predictable user paths.

## Performance Targets

### When Code Splitting is Worth It

**Minimum data size**: 300+ lines or 10KB+
**Expected reduction**: >30% initial bundle
**Load frequency**: Data used <50% of the time

### Measuring Impact

**Before**:
```javascript
performance.mark('widget-start');
// ... widget initialization
performance.mark('widget-ready');
performance.measure('widget-load', 'widget-start', 'widget-ready');
```

**After**:
```javascript
performance.mark('widget-start');
// ... core initialization
performance.mark('widget-ready');
// ... lazy data load
performance.mark('data-loaded');

performance.measure('core-load', 'widget-start', 'widget-ready');
performance.measure('data-load', 'widget-ready', 'data-loaded');
```

**Target**: Core load <50% of original total load time.

## Common Pitfalls

### ❌ Splitting Too Aggressively
```javascript
// BAD: Too many small files
await loadScript('data/item-1.js');  // 20 lines
await loadScript('data/item-2.js');  // 25 lines
await loadScript('data/item-3.js');  // 18 lines
```

**Fix**: Group related small items into larger modules (100+ lines each).

### ❌ Synchronous Access After Load
```javascript
// BAD: No await
loadData();  // Returns promise
const value = DATA.key;  // Undefined! Data not loaded yet
```

**Fix**: Always await lazy loads before accessing data.

### ❌ No Loading Indicator
```javascript
// BAD: User sees blank screen during load
await loadScript('large-file.js');  // 3 second delay
```

**Fix**: Show spinner, progress bar, or skeleton UI.

### ❌ Missing Error Recovery
```javascript
// BAD: Network error crashes widget
await loadScript('data/module.js');  // Throws on 404
```

**Fix**: Try-catch with fallback to defaults or cached data.

## Testing Code-Split Widgets

### Manual Testing

1. **Clear cache** - Ensure clean load
2. **Throttle network** - DevTools → Network → Slow 3G
3. **Check console** - Verify modules loaded in correct order
4. **Monitor network** - DevTools → Network tab
5. **Check memory** - DevTools → Memory → Take heap snapshot

### Automated Testing

```javascript
// Verify lazy loading doesn't break functionality
test('widget loads without data', async () => {
    const widget = new Widget();
    assert(widget.data === null || Object.keys(widget.data).length === 0);
});

test('data loads on demand', async () => {
    const widget = new Widget();
    await widget.selectItem('item1');
    assert(widget.data.item1 !== undefined);
});

test('subsequent access uses cache', async () => {
    const widget = new Widget();
    await widget.selectItem('item1');
    const loadCount1 = window.scriptLoadCount;
    await widget.selectItem('item1');
    const loadCount2 = window.scriptLoadCount;
    assert(loadCount1 === loadCount2); // No additional load
});
```

## Examples in SimGlass

### Checklist Widget v3.0.0
- **Split**: 1,926 lines into 4 category files
- **Reduction**: 78.6% initial bundle
- **Load time**: 62.5% faster
- **Pattern**: Category-based splitting

### Copilot Widget v3.0.0
- **Split**: 473 lines into 2 mode files
- **Reduction**: 19.8% initial bundle
- **Pattern**: Mode-based splitting

### GTN750 v2.1.0
- **Split**: 6 modules with deferred loading
- **Pattern**: Feature-based splitting with ModuleLoader
- **See**: `ui/gtn750/` for full implementation

## Migration Checklist

When adding code splitting to an existing widget:

- [ ] Identify large data structures (>300 lines)
- [ ] Determine splitting strategy (category/mode/feature)
- [ ] Create data/ directory
- [ ] Extract data into separate files
- [ ] Create loader utility
- [ ] Update main pane.js to use empty objects
- [ ] Add async loading methods
- [ ] Add loading indicators
- [ ] Add error handling with fallbacks
- [ ] Update index.html to load registry/loader
- [ ] Test with network throttling
- [ ] Measure performance improvement
- [ ] Update widget version (minor bump)
- [ ] Document in CODE-SPLITTING.md
- [ ] Create backup of original file

## Version Bumping

When implementing code splitting:
- **Minor version bump** - v2.0.0 → v3.0.0
- **Reason**: Architecture change, though backward compatible
- **Changelog**: Document bundle size reduction and load time improvements

## Credits

Code splitting patterns inspired by:
- Webpack code splitting
- React.lazy() and Suspense
- Dynamic imports (ES modules)

Adapted for SimGlass's `<script>` tag architecture (no bundler).
