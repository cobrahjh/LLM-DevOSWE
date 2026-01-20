# Hive Display Standards
**Version:** 1.0.0
**Last Updated:** 2026-01-16

Responsive design standards for all Hive devices and interfaces.

---

## Hive Device Specifications

| Device | Type | Viewport (CSS) | Resolution | Pixel Ratio | Screen |
|--------|------|----------------|------------|-------------|--------|
| **Harold-PC** | Desktop | 1920x1080 | 1920x1080 | 1x | 27" |
| **ai-pc** | 2-in-1 | 1280x800 | 1920x1200 | 1.5x | 13" |
| **morpu-pc** | Micro PC | Headless | N/A | N/A | None |
| **S25 Ultra** | Phone | 485x1080 | 1440x3220 | 3x | 6.9" |

---

## Standard Breakpoints (2025-2026)

### Mobile-First Approach (Recommended)

```css
/* Mobile First - Start here */
/* Base styles for mobile (320px+) */

/* Large phones / Small tablets */
@media (min-width: 480px) { }

/* Tablets portrait */
@media (min-width: 768px) { }

/* Tablets landscape / Small laptops */
@media (min-width: 1024px) { }

/* Desktops */
@media (min-width: 1280px) { }

/* Large desktops */
@media (min-width: 1440px) { }

/* Full HD+ */
@media (min-width: 1920px) { }
```

### Hive-Specific Breakpoints

```css
/* S25 Ultra Portrait */
@media (max-width: 485px) {
    /* Mobile-optimized layout */
}

/* S25 Ultra Landscape / ai-pc */
@media (min-width: 486px) and (max-width: 1079px) {
    /* Tablet-optimized layout */
}

/* ai-pc Full / Harold-PC */
@media (min-width: 1080px) {
    /* Desktop layout */
}
```

---

## Device-Specific Guidelines

### S25 Ultra (Primary Mobile)

| Property | Value |
|----------|-------|
| CSS Viewport | 485 x 1080 |
| Physical Resolution | 1440 x 3220 |
| Pixel Ratio | 3x |
| Screen Size | 6.9" |
| Min Touch Target | 44 x 44 px |
| Base Font Size | 16px (renders at 147 PPI) |

**Design Rules:**
- Use viewport width 485px in media queries
- Provide @2x or @3x images for crisp display
- Minimum button size: 44x44px
- Avoid hover-dependent interactions
- Support both portrait (485x1080) and landscape (1080x485)

### ai-pc (2-in-1 Tablet/Laptop)

| Property | Value |
|----------|-------|
| CSS Viewport | ~1280 x 800 |
| Touch Support | Yes |
| Orientation | Both |

**Design Rules:**
- Support touch AND mouse input
- Larger touch targets when in tablet mode
- Flexible layouts for orientation changes

### Harold-PC (Desktop Workstation)

| Property | Value |
|----------|-------|
| CSS Viewport | 1920 x 1080 |
| Input | Mouse + Keyboard |
| Multi-monitor | Possible |

**Design Rules:**
- Full desktop layouts
- Hover states enabled
- Keyboard shortcuts
- Dense information display OK

---

## CSS Variables for Hive

```css
:root {
    /* Breakpoints */
    --bp-mobile: 485px;
    --bp-tablet: 768px;
    --bp-laptop: 1024px;
    --bp-desktop: 1280px;
    --bp-wide: 1920px;

    /* Touch targets */
    --touch-min: 44px;
    --touch-comfortable: 48px;

    /* Font scaling */
    --font-base: 16px;
    --font-mobile: 14px;
    --font-desktop: 16px;

    /* Spacing */
    --spacing-mobile: 8px;
    --spacing-desktop: 16px;

    /* Hive brand colors */
    --hive-primary: #FF6B00;
    --hive-secondary: #1A1A2E;
    --hive-accent: #00D4FF;
    --hive-success: #00FF88;
    --hive-warning: #FFD93D;
    --hive-error: #FF4444;
}
```

---

## Image Guidelines

### Responsive Images

```html
<!-- Serve appropriate resolution based on device -->
<img
    src="image-1x.jpg"
    srcset="image-1x.jpg 1x,
            image-2x.jpg 2x,
            image-3x.jpg 3x"
    alt="Description"
/>
```

### Image Sizes by Device

| Device | 1x | 2x | 3x |
|--------|----|----|-----|
| S25 Ultra | - | 970px | 1455px |
| ai-pc | 1280px | 2560px | - |
| Harold-PC | 1920px | - | - |

---

## Typography Scale

```css
/* Mobile (S25 Ultra) */
@media (max-width: 485px) {
    html { font-size: 14px; }
    h1 { font-size: 1.75rem; }  /* 24.5px */
    h2 { font-size: 1.5rem; }   /* 21px */
    h3 { font-size: 1.25rem; }  /* 17.5px */
    body { font-size: 1rem; }   /* 14px */
    small { font-size: 0.875rem; } /* 12.25px */
}

/* Tablet (ai-pc) */
@media (min-width: 486px) and (max-width: 1079px) {
    html { font-size: 15px; }
    h1 { font-size: 2rem; }     /* 30px */
    h2 { font-size: 1.5rem; }   /* 22.5px */
    h3 { font-size: 1.25rem; }  /* 18.75px */
}

/* Desktop (Harold-PC) */
@media (min-width: 1080px) {
    html { font-size: 16px; }
    h1 { font-size: 2.5rem; }   /* 40px */
    h2 { font-size: 2rem; }     /* 32px */
    h3 { font-size: 1.5rem; }   /* 24px */
}
```

---

## Component Sizing

### Buttons

| Context | Min Width | Min Height | Padding |
|---------|-----------|------------|---------|
| Mobile Touch | 120px | 44px | 12px 24px |
| Tablet | 100px | 40px | 10px 20px |
| Desktop | 80px | 36px | 8px 16px |

### Input Fields

| Context | Height | Font Size | Padding |
|---------|--------|-----------|---------|
| Mobile | 48px | 16px | 12px |
| Tablet | 44px | 15px | 10px |
| Desktop | 40px | 14px | 8px |

### Navigation

| Context | Item Height | Icon Size |
|---------|-------------|-----------|
| Mobile | 56px | 24px |
| Tablet | 48px | 22px |
| Desktop | 44px | 20px |

---

## Testing Checklist

### Before Release

- [ ] Test on S25 Ultra viewport (485x1080)
- [ ] Test on S25 Ultra landscape (1080x485)
- [ ] Test on ai-pc tablet mode (1280x800)
- [ ] Test on Harold-PC (1920x1080)
- [ ] Verify touch targets >= 44px on mobile
- [ ] Check image clarity on 3x displays
- [ ] Test keyboard navigation on desktop
- [ ] Verify no horizontal scroll on any device

---

## Sources

- [BrowserStack Responsive Design Breakpoints](https://www.browserstack.com/guide/responsive-design-breakpoints)
- [BrowserStack Common Screen Resolutions 2026](https://www.browserstack.com/guide/common-screen-resolutions)
- [Samsung Galaxy S25 Ultra Viewport Specs](https://phone-simulator.com/devices/samsung-galaxy-s25-ultra)
- [LambdaTest S25 Ultra Testing](https://www.lambdatest.com/lt-browser/screen-resolution-testing-on-samsung-galaxy-s25-ultra)
- [Microsoft Windows Responsive Design](https://learn.microsoft.com/en-us/windows/apps/design/layout/screen-sizes-and-breakpoints-for-responsive-design)
