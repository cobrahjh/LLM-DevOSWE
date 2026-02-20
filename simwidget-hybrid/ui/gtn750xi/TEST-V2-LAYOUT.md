# GTN750Xi V2 Layout - Browser Testing

**V2 URL:** `http://192.168.1.42:8080/ui/gtn750xi/?layout=v2`

---

## Quick Console Test

Open browser console (F12) at V2 URL and run:

```javascript
// Verify V2 layout was applied
console.log('Layout class:', document.querySelector('.gtn750xi')?.classList.contains('layout-v2') ? '✅ V2' : '❌ V1');

// Check V1 home buttons are hidden
const homeButtons = document.querySelector('.home-buttons');
console.log('V1 home buttons hidden:', homeButtons?.style.display === 'none' ? '✅ Yes' : '❌ No');

// Check app grid exists
const appGrid = document.querySelector('.app-grid');
console.log('App grid exists:', appGrid ? '✅ Yes' : '❌ No');

// Count app icons
const icons = document.querySelectorAll('.app-icon');
console.log('App icons:', icons.length === 12 ? `✅ 12` : `❌ ${icons.length}`);

// Check page locator exists
const locator = document.querySelector('.page-locator');
console.log('Page locator exists:', locator ? '✅ Yes' : '❌ No');

// Count locator items
const locatorItems = document.querySelectorAll('.page-locator-item');
console.log('Locator items:', locatorItems.length === 5 ? `✅ 5` : `❌ ${locatorItems.length}`);

// Check V2 CSS loaded
const v2CSS = Array.from(document.styleSheets).some(sheet =>
    sheet.href && sheet.href.includes('theme-v2-appgrid.css')
);
console.log('V2 CSS loaded:', v2CSS ? '✅ Yes' : '❌ No');
```

**Expected Output:**
```
Layout class: ✅ V2
V1 home buttons hidden: ✅ Yes
App grid exists: ✅ Yes
App icons: ✅ 12
Page locator exists: ✅ Yes
Locator items: ✅ 5
V2 CSS loaded: ✅ Yes
```

---

## Visual Inspection

### What You Should See

**App Icon Grid (4×3):**
- Top area replaces horizontal home buttons
- 12 large square icons in a 4-column grid
- Row 1: 🌍 Map | ✈️ Traffic | ⛰️ Terrain | 🌦️ Weather
- Row 2: 📄 Charts | ✈️ Flight Plan | 🛫 PROC | 📍 Nearest
- Row 3: 📌 Waypoint Info | 🚕 SafeTaxi | 🧰 Utilities | ⚙️ System
- Icons have gradient backgrounds
- Hover effect: cyan border glow + lift animation

**Page Locator Bar:**
- Below the app grid or at bottom (depending on final positioning)
- Horizontal bar: ◀ MAP | FPL | NRST | PROC | UTIL ▶
- Active page highlighted with cyan background
- Click any item to navigate

**Rest of UI (Unchanged):**
- Frequency bar at top (COM/NAV/XPDR)
- CDI bar above soft keys
- Soft keys at bottom (context-dependent)
- Status bar at very bottom

---

## Functional Tests

### 1. Test App Icon Navigation
**Action:** Click **Utilities** icon (🧰, row 3, column 3)

**Expected:**
- AUX page opens
- Soft keys show: TRIP, FUEL, DALT, VCALC, CHKLIST, TIMER
- Page locator highlights **UTIL** (if AUX is mapped)

### 2. Test Page Locator Navigation
**Action:** Click **FPL** in page locator bar

**Expected:**
- Flight Plan page opens
- FPL item in locator bar gets cyan background
- Soft keys change to FPL context (SAVE, LOAD, INVERT, VNAV, CLEAR, D→)

### 3. Test Icon Grid → Planning Utilities
**Action:**
1. Click **Utilities** icon
2. Click **TRIP** soft key

**Expected:**
- Trip Planning page opens
- All inputs visible (P. Position, From, To, etc.)
- Soft keys: MODE, SENSOR, NEXT, PREV, BACK

### 4. Test V1 Still Works
**Action:** Navigate to `http://192.168.1.42:8080/ui/gtn750xi/` (no ?layout param)

**Expected:**
- V1 layout loads (horizontal home buttons at top)
- No app grid
- No page locator bar
- Everything works as before

---

## Expected Behavior

| Test | V1 URL | V2 URL |
|------|--------|--------|
| Home buttons visible | ✅ Yes | ❌ No (hidden) |
| App grid visible | ❌ No | ✅ Yes |
| Page locator visible | ❌ No | ✅ Yes |
| Pages work | ✅ Yes | ✅ Yes |
| Planning utilities | ✅ Yes | ✅ Yes |
| Soft keys | ✅ Yes | ✅ Yes |

---

## Troubleshooting

**App grid doesn't appear:**
- Check browser console for errors
- Verify `?layout=v2` is in URL
- Check network tab: layouts/layout-v2-home.html should load (HTTP 200)
- Verify `.layout-v2` class is on container

**Icons don't navigate:**
- Check browser console for JavaScript errors
- Verify pageManager exists: `window.gtn750xi?.pageManager`
- Try clicking page locator items instead

**V2 CSS not loading:**
- Check network tab for theme-v2-appgrid.css
- Verify no 404 errors
- Check if `.app-grid` styles are applied (inspect element)

**Page locator doesn't highlight:**
- Check if `updatePageLocator()` is being called
- Inspect `.page-locator-item.active` class
- May need page change event wiring

---

## Success Criteria

V2 layout passes if:
- ✅ URL `?layout=v2` triggers app grid view
- ✅ 12 app icons visible in 4×3 grid
- ✅ Page locator bar visible at bottom
- ✅ Clicking icons navigates to pages
- ✅ Clicking locator items navigates to pages
- ✅ V1 layout still works (no ?layout param)
- ✅ All Planning utilities accessible via Utilities icon
- ✅ Zero code duplication confirmed

---

**Please open the V2 URL in your browser and let me know what you see!**

`http://192.168.1.42:8080/ui/gtn750xi/?layout=v2`
