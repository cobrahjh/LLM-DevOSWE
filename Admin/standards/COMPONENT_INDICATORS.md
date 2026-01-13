# Component Cost & Process Indicators Standard v1.0.0
**Last Updated: 2026-01-09**
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\Admin\standards\COMPONENT_INDICATORS.md

## Overview
All UI components that trigger processes must display visual indicators showing:
- **Cost type** (tokens/free)
- **Processor** (Kitt AI / Local / API)
- **Process type** (API call / Local / WebSocket)

## Indicator Types

### 1. Cost Indicators (Bottom-left of component)
| Indicator | Meaning | CSS Class |
|-----------|---------|-----------|
| `🪙` | Costs tokens (AI processing) | `.indicator-tokens` |
| `🆓` | Free (no token cost) | `.indicator-free` |

### 2. Processor Indicators (Bottom-right of component)
| Indicator | Meaning | CSS Class |
|-----------|---------|-----------|
| `🤖` | Processed by Kitt (AI) | `.indicator-kitt` |
| `💻` | Local processing | `.indicator-local` |
| `🌐` | External API call | `.indicator-api` |

### 3. Combined Examples
| Component Action | Indicators | Meaning |
|-----------------|------------|---------|
| Chat message | `🪙 🤖` | Costs tokens, Kitt processes |
| Restart server | `🆓 💻` | Free, local command |
| Weather lookup | `🆓 🌐` | Free, external API |
| Code analysis | `🪙 🤖` | Costs tokens, Kitt analyzes |
| File read | `🆓 💻` | Free, local file system |

## CSS Implementation

```css
/* Base indicator styles */
.component-indicators {
    position: absolute;
    bottom: 4px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    opacity: 0.6;
    pointer-events: none;
}

.component-indicators:hover {
    opacity: 1;
}

/* Cost indicators */
.indicator-tokens {
    color: #f59e0b; /* amber */
}

.indicator-free {
    color: #22c55e; /* green */
}

/* Processor indicators */
.indicator-kitt {
    color: #4a9eff; /* blue */
}

.indicator-local {
    color: #a855f7; /* purple */
}

.indicator-api {
    color: #ec4899; /* pink */
}

/* Tooltip on hover */
.indicator-tokens::after { content: ' Tokens'; }
.indicator-free::after { content: ' Free'; }
.indicator-kitt::after { content: ' Kitt'; }
.indicator-local::after { content: ' Local'; }
.indicator-api::after { content: ' API'; }
```

## HTML Structure

```html
<button class="admin-btn" onclick="sendQuick('analyze code')">
    🔍 Analyze Code
    <div class="component-indicators">
        <span class="indicator-tokens">🪙</span>
        <span class="indicator-kitt">🤖</span>
    </div>
</button>

<button class="admin-btn" onclick="restartServer()">
    🔄 Restart
    <div class="component-indicators">
        <span class="indicator-free">🆓</span>
        <span class="indicator-local">💻</span>
    </div>
</button>
```

## JavaScript Helper

```javascript
/**
 * Add indicators to a component
 * @param {HTMLElement} element - Target element
 * @param {Object} options - Indicator options
 * @param {boolean} options.costsTokens - Whether it costs tokens
 * @param {string} options.processor - 'kitt' | 'local' | 'api'
 */
function addIndicators(element, { costsTokens = false, processor = 'local' }) {
    element.style.position = 'relative';
    
    const indicators = document.createElement('div');
    indicators.className = 'component-indicators';
    
    // Cost indicator
    const costSpan = document.createElement('span');
    costSpan.className = costsTokens ? 'indicator-tokens' : 'indicator-free';
    costSpan.textContent = costsTokens ? '🪙' : '🆓';
    costSpan.title = costsTokens ? 'Costs tokens' : 'Free';
    
    // Processor indicator
    const procSpan = document.createElement('span');
    const procMap = {
        kitt: { class: 'indicator-kitt', icon: '🤖', title: 'Processed by Kitt' },
        local: { class: 'indicator-local', icon: '💻', title: 'Local processing' },
        api: { class: 'indicator-api', icon: '🌐', title: 'External API' }
    };
    const proc = procMap[processor] || procMap.local;
    procSpan.className = proc.class;
    procSpan.textContent = proc.icon;
    procSpan.title = proc.title;
    
    indicators.appendChild(costSpan);
    indicators.appendChild(procSpan);
    element.appendChild(indicators);
}

// Usage examples:
// addIndicators(chatBtn, { costsTokens: true, processor: 'kitt' });
// addIndicators(restartBtn, { costsTokens: false, processor: 'local' });
// addIndicators(weatherBtn, { costsTokens: false, processor: 'api' });
```

## Component Classification Guide

### Token-Costing (🪙 🤖)
- Chat messages to Kitt
- Code analysis/generation
- Document summarization
- Any Claude API call

### Free Local (🆓 💻)
- Server restart/stop
- File operations (read/write/delete)
- Process management
- Log viewing
- Settings changes
- TODO list operations

### Free API (🆓 🌐)
- External service calls (weather, etc.)
- Webhook triggers
- Third-party integrations

### Free Kitt (🆓 🤖)
- Cached responses
- Pre-computed answers
- Template responses

## Implementation Checklist

When creating new components:
- [ ] Determine if action costs tokens
- [ ] Identify processor type (Kitt/Local/API)
- [ ] Add indicator container to HTML
- [ ] Apply appropriate CSS classes
- [ ] Add tooltips for accessibility
- [ ] Test indicator visibility at all screen sizes

## Notes
- Indicators should be subtle (60% opacity by default)
- Show full labels on hover
- Position consistently across all components
- Update indicators if component behavior changes
