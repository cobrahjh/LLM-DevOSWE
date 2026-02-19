# GTN750 Glass — Performance Improvements

**Current Version:** v3.0+
**Last Updated:** 2026-02-19

---

## 📊 Cumulative Benchmarks

| Metric | v2.2.0 (baseline) | v2.3.0 | v3.0+ |
|--------|-------------------|--------|-------|
| Frame time (avg) | 16.8ms | 14.5ms | ~8–10ms est. |
| Frame time (95th%) | 21.2ms | 18.9ms | <15ms est. |
| Frame time (99th%) | 23.4ms | 20.1ms | — |
| Memory (10 min) | 11.2MB | 9.8MB | Stable |
| Waypoint calcs/sec | 600 | 10 | 10 |
| Map render time | 3.2ms | 3.2ms | ~1–1.5ms est. |
| Route rendering | 4.8ms | 2.1ms | ~1ms est. |
| Weather overlay | 1.8ms | 1.8ms | ~0.7ms est. |
| SafeTaxi render | — | — | -60–80% |
| UI update rate | 60Hz | 60Hz | 5Hz (throttled) |

---

## v3.0+ Optimizations

### 1. ThrottleManager — UI Update Rate (5Hz)

**Problem:** All UI updates (DOM writes, module cascade, display calculations) fired on every WebSocket message — effectively at sim telemetry rate (~20Hz+), far faster than needed.

**Solution:** ThrottleManager caps the UI/module update cascade to 200ms intervals (5Hz), matching real GTN 750 avionics refresh rate. Data model and CDI nav updates remain instant for map renderer accuracy.

**Impact:** Eliminates unnecessary DOM thrashing; main thread freed for rendering.

**File:** `pane.js`

---

### 2. Map Renderer Canvas Caching (50–70% boost)

**Problem:** Range rings, compass rose, and flight plan route were redrawn every frame even when nothing changed.

**Solution:** Multi-layer off-screen canvas caching:
- **Static layer** — range rings, compass rose; only redrawn on zoom/orientation change
- **Route layer** — flight plan legs; only redrawn when waypoints change
- Cache invalidation triggered by state hash comparison

**Impact:** Map render time reduced ~50–70%. Matches same pattern as SafeTaxi optimization.

**Files:** `modules/gtn-map-renderer.js` (+114 lines)

---

### 3. SafeTaxi Static Layer Caching (60–80% boost)

**Problem:** Airport diagram background (taxiways, runways, apron) was re-rendered every frame.

**Solution:** Static diagram layers rendered once to off-screen canvas; composited each frame instead of redrawn.

**Impact:** 60–80% reduction in SafeTaxi render time per frame.

**File:** `modules/gtn-map-renderer.js` (SafeTaxi section)

---

### 4. Weather Overlay — Viewport Culling + Layer Caching

**Problem:** Weather overlay recalculated all METAR/TAF symbols and radar tiles every frame regardless of data changes or viewport position.

**Solution:**
- **METAR/TAF layer caching** — off-screen canvas; only regenerates on position/zoom/data change
- **Aggressive viewport culling** — radar tiles culled at 1.2× range (was 1.5×) with screen-space bounds checking
- **Progressive tile loading** — tiles sorted by distance from aircraft, closest rendered first
- **Auto cache invalidation** — caches cleared on new data fetch

**Impact:** ~60% reduction in weather overlay render time for dense METAR areas.

**File:** `modules/gtn-weather-panel.js`

---

## v2.3.0 Optimizations

### 5. Waypoint Position Caching (98% calc reduction)

**Problem:** `latLonToCanvas()` called for every waypoint every frame at 60 FPS — 10-waypoint route = 600 trig calculations/second.

**Solution:** Cache keyed on `round(lat*100), round(lon*100), range, round(rotation)`. Cache cleared only when aircraft moves >0.01° (~0.6nm), range changes, or orientation changes >1°. At 300kt the cache stays valid for ~7 seconds between invalidations.

**Impact:**
- Calculations: 600/sec → ~10/sec (98% reduction)
- Route render time: 4.8ms → 2.1ms (-56%)
- Avg frame time: 16.8ms → 14.5ms (-13.7%)
- 95th percentile: 21.2ms → 18.9ms (below 20ms target)

**File:** `modules/gtn-map-renderer.js`

---

### 6. Traffic Circular Buffer

**Problem:** Traffic targets accumulated without bound — 300+ targets after 10 minutes, reaching 11.2MB.

**Solution:** `Map`-based circular buffer with hard ceiling:
- Max 100 simultaneous targets
- 30s stale timeout — targets not seen in 30s removed on each update cycle
- Capacity enforcement — oldest entries removed if >100 targets
- `Map` structure gives O(1) lookup/insert vs O(n) array

**Impact:**
- Memory after 10 min: 11.2MB → 9.8MB, stable indefinitely
- Traffic data footprint: ~60KB → ~20KB (67% reduction)

**File:** `overlays/traffic-overlay.js`

---

## v2.1.0 Optimizations

### 7. Code Splitting — 40% Faster Initial Load

**Problem:** All 17 modules loaded synchronously on startup, blocking render for ~2 seconds.

**Solution:** Split into 13 critical (loaded immediately) + deferred modules loaded on first page visit. Pages like proc, aux, charts, nrst, system only load when navigated to.

**Impact:** Initial load ~2s → ~1.2s (40% faster).

---

## Open Performance Items

| Item | Current | Target | Strategy |
|------|---------|--------|----------|
| Weather overlay initial load | ~124ms | <100ms | Progressive tile loading (center-first spiral) — partially implemented, not yet hitting target |
| Web Worker for calculations | — | Future | Offload bearing/distance math off main thread |

---

## Running Performance Tests

```bash
# Full test suite (includes performance assertions)
node tests/test-runner.js

# Advanced features including render benchmarks
new AdvancedFeaturesTest().runAll()   # browser console
```

---

## Related Documents

- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) — Open issues including weather load time
- [IMPROVEMENTS.md](IMPROVEMENTS.md) — Full versioned changelog
- [FEATURE-STATUS.md](FEATURE-STATUS.md) — Feature audit
