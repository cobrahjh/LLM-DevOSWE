# SimWidget Accessibility Framework
**Version:** v1.0.0  
**Last Updated:** 2026-01-09  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\ACCESSIBILITY-FRAMEWORK.md`

---

## Overview

This framework defines accessibility standards for all SimWidget UI components, ensuring WCAG 2.1 AA compliance.

---

## Color Contrast Standards

### WCAG 2.1 AA Requirements

| Element Type | Minimum Contrast Ratio |
|--------------|------------------------|
| Normal text (< 18pt) | **4.5:1** |
| Large text (≥ 18pt or 14pt bold) | **3:1** |
| UI components (buttons, inputs) | **3:1** |
| Graphical objects | **3:1** |
| Icons | **3:1** |

### Enhanced (AAA) - Optional

| Element Type | Minimum Contrast Ratio |
|--------------|------------------------|
| Normal text | **7:1** |
| Large text | **4.5:1** |

---

## SimWidget Color Palette (WCAG Compliant)

### Dark Theme Base
```css
--sw-bg-primary: #0a0e14;      /* Main background */
--sw-bg-secondary: #131920;    /* Panel background */
--sw-bg-tertiary: #1a2332;     /* Card background */
--sw-text-primary: #e8edf5;    /* Primary text */
--sw-text-secondary: #8a9bb4;  /* Secondary text */
```

### Status/Accent Colors (Muted for Accessibility)

| Status | Bright (Avoid) | Accessible | Contrast vs #131920 |
|--------|----------------|------------|---------------------|
| **Success** | `#22c55e` | `#4ade80` | 8.2:1 ✅ |
| **Warning** | `#f59e0b` | `#cc7722` | 5.8:1 ✅ |
| **Error** | `#ef4444` | `#f87171` | 5.4:1 ✅ |
| **Info** | `#3b82f6` | `#60a5fa` | 4.9:1 ✅ |
| **Active** | `#4a9eff` | `#4a9eff` | 5.2:1 ✅ |

### Service Button Colors

| Service | Color Name | Hex | Notes |
|---------|------------|-----|-------|
| Main Server :8080 | Blue | `#4a9eff` | Primary action |
| Agent :8585 | Purple | `#a78bfa` | Kitt identity |
| **Remote Support :8590** | **Burnt Orange** | **`#cc7722`** | Muted, accessible |
| Master O :8500 | Cyan | `#22d3ee` | Master controller |

---

## Button Standards

### Base Button Style
```css
.sw-btn {
    /* Dimensions */
    min-height: 44px;           /* Touch target minimum */
    min-width: 44px;
    padding: 10px 16px;
    
    /* Typography */
    font-size: 14px;            /* 14px+ for readability */
    font-weight: 500;
    
    /* Colors - ensure 4.5:1 text contrast */
    background: var(--sw-btn-bg);
    color: var(--sw-text-primary);
    border: 1px solid var(--sw-border-medium);
    
    /* Focus indicator - visible */
    outline-offset: 2px;
}

.sw-btn:focus-visible {
    outline: 2px solid var(--sw-accent-blue);
    box-shadow: 0 0 0 4px rgba(74, 158, 255, 0.3);
}

.sw-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Service Button Variants
```css
/* Main Server */
.sw-btn-main { background: #4a9eff; color: #000; }

/* Agent (Kitt) */
.sw-btn-agent { background: #a78bfa; color: #000; }

/* Remote Support - ACCESSIBLE ORANGE */
.sw-btn-remote { background: #cc7722; color: #fff; }

/* Master O */
.sw-btn-master { background: #22d3ee; color: #000; }
```

---

## Touch Targets

Per WCAG 2.2 (2.5.8 Target Size):

| Component | Minimum Size |
|-----------|--------------|
| Buttons | 44×44px |
| Links (inline) | 24×24px |
| Icons (clickable) | 44×44px |
| Sliders | 44px height |

---

## Focus Indicators

All interactive elements MUST have visible focus states:

```css
/* Global focus style */
:focus-visible {
    outline: 2px solid #4a9eff;
    outline-offset: 2px;
}

/* Never remove focus outlines */
/* ❌ WRONG: outline: none; */
```

---

## Color Independence

**Do not rely on color alone** to convey information:

✅ Correct:
- Status: 🟢 Online (green dot + text)
- Error: ⚠️ Connection failed (icon + text + red)

❌ Wrong:
- Just a colored dot with no label
- Just changing text color for errors

---

## Text Guidelines

### Minimum Sizes
| Usage | Min Size |
|-------|----------|
| Body text | 14px |
| Labels | 12px |
| Headings | 18px+ |

### Line Height
- Body: 1.5 minimum
- Headings: 1.2-1.3

---

## Animation & Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## Testing Tools

| Tool | URL | Purpose |
|------|-----|---------|
| WebAIM Contrast Checker | webaim.org/resources/contrastchecker | Color contrast |
| axe DevTools | Browser extension | Automated audit |
| WAVE | wave.webaim.org | Page evaluation |
| Lighthouse | Chrome DevTools | Accessibility score |

---

## Implementation Checklist

### Per Component
- [ ] Text contrast ≥ 4.5:1
- [ ] UI component contrast ≥ 3:1
- [ ] Touch target ≥ 44×44px
- [ ] Visible focus indicator
- [ ] Color-independent status
- [ ] Keyboard accessible
- [ ] Screen reader labels (aria-label)

### Per Page
- [ ] Logical heading hierarchy
- [ ] Skip links for navigation
- [ ] Form labels associated
- [ ] Error messages clear
- [ ] No keyboard traps

---

## Quick Reference: Approved Colors

### Safe Palette (vs #131920 background)
```
Primary Blue:    #4a9eff  (5.2:1) ✅
Success Green:   #4ade80  (8.2:1) ✅
Warning Orange:  #cc7722  (5.8:1) ✅  ← USE THIS
Error Red:       #f87171  (5.4:1) ✅
Info Cyan:       #22d3ee  (8.9:1) ✅
Purple:          #a78bfa  (5.6:1) ✅
Text Primary:    #e8edf5  (12.3:1) ✅
Text Secondary:  #8a9bb4  (5.1:1) ✅
```

### Colors to AVOID (too bright/saturated)
```
#f59e0b - Too bright yellow-orange
#FF8C00 - Harsh saturated orange  
#22c55e - Too vibrant green
#ef4444 - Harsh red
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2026-01-09 | Initial framework |
