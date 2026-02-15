# Quick Test Reference Card

## 🚀 Fast 5-Minute Test

### Setup
1. Open both pages (use `open-test-pages.bat`)
2. Press F12 in both tabs
3. Enable AI in AI Autopilot tab (click ON button)

---

## ✅ Quick Checks

### 1️⃣ GTN750 Console (paste this):
```js
const testCh = new SafeChannel('SimGlass-sync');
testCh.onmessage = (e) => {
  if (e.data.type === 'nav-state') {
    console.log('✅ Nav-state:', e.data.data.activeWaypoint?.ident);
  }
};
```
**PASS**: Messages every ~1 second

---

### 2️⃣ AI Autopilot Console (paste this):
```js
widget.ruleEngine.getNavGuidance()
```
**PASS**: Returns object with wpIdent, NOT null

---

### 3️⃣ AI Autopilot UI (visual):
- **Heading target** shows: `KDEN 125.8nm` ✅
- NOT: `HDG 305°` ❌

---

### 4️⃣ AP Status NAV row:
- Shows: `GPS` ✅ (when on course)

---

### 5️⃣ Close GTN750 tab:
- Heading changes to `HDG 305°` ✅
- No errors ✅
- Reopen → waypoint returns ✅

---

## 🎯 All 5 Pass = SUCCESS!

**Next**: Commit changes, update MEMORY.md, deploy to harold-pc

**Fail**: See MANUAL-TEST-GUIDE.md for detailed debugging
