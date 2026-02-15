# AI Autopilot Weather Integration Guide

**Status**: ✅ PRODUCTION READY
**Version**: v3.0.0 (AI Autopilot)
**Date**: February 14, 2026

## Overview

AI Autopilot includes comprehensive weather integration for weather-aware flight automation. Features wind drift compensation, turbulence detection, and crosswind component calculations for safe operations in varying weather conditions.

**Key Features:**
- **Wind Drift Compensation** - Automatic heading correction for wind
- **Wind Triangle Math** - Calculates heading correction from wind velocity, track, and TAS
- **Crosswind Components** - Calculates crosswind/headwind relative to heading or runway
- **Turbulence Detection** - Classifies turbulence severity (light/moderate/severe)
- **Weather Panel UI** - Auto-shows when wind >3kt or turbulence detected
- **Rule Engine Integration** - Applied automatically during navigation

---

## Wind Compensation

### Wind Triangle Math

**Problem:** Aircraft heading ≠ ground track when wind is present.

**Solution:** Calculate heading correction angle to maintain desired ground track.

**Wind Triangle:**
```
         Wind Vector
              ↑
              |
       ╱──────┘
     ╱ θ (correction angle)
   ╱
 ↗
Aircraft Heading
```

**Formula:**
```javascript
// Given:
// - desiredTrack: Desired ground track (°)
// - windDir: Wind direction (° from)
// - windSpd: Wind speed (kt)
// - tas: True airspeed (kt)

// Calculate:
const wca = calculateWindCorrectionAngle(desiredTrack, windDir, windSpd, tas);
const heading = desiredTrack + wca;

// Wind correction angle (WCA) calculation:
function calculateWindCorrectionAngle(track, windDir, windSpd, tas) {
    // Wind angle relative to track
    const windAngle = windDir - track + 180;  // Convert "from" to "to"

    // Crosswind component
    const xwind = windSpd * Math.sin(toRadians(windAngle));

    // Calculate correction angle
    const wca = Math.asin(xwind / tas) * (180 / Math.PI);

    return wca;
}
```

**Example:**
```
Desired track: 090° (due east)
Wind: 180° at 20kt (south wind, blowing north)
TAS: 120kt

Wind angle: 180 - 90 + 180 = 270° (90° off track)
Crosswind: 20 * sin(270°) = -20kt (full crosswind from right)
WCA: asin(-20 / 120) = -9.6° ≈ -10°

Heading: 090° + (-10°) = 080° (crab left into wind)

Result: Fly heading 080° to maintain ground track 090°
```

---

### Auto Wind Compensation

**When Applied:**
- Wind speed > 1kt
- Aircraft speed > 50kt
- NAV mode active (tracking GPS waypoints)

**How It Works:**
```javascript
// In rule-engine-core.js
_applyLateralNav(d, profile) {
    if (!this._shouldUseNavMode(d)) return;

    // Get nav heading from GTN750
    const navHeading = this._getNavHeading();

    // Apply wind compensation
    const windCorrection = this._windComp.calculateWindCorrection(
        navHeading,          // Desired track
        d.windDirection,     // Wind direction (°)
        d.windSpeed,         // Wind speed (kt)
        d.airspeed          // TAS (kt)
    );

    const correctedHeading = navHeading + windCorrection;

    this._steerToHeading(correctedHeading, d.heading, 'NAV_WIND_COMP');

    // Log correction in command log
    this._logCommand(`Wind drift correction: ${windCorrection.toFixed(1)}°`);
}
```

**Display:**
```
Command Log:
"KDEN 125.4nm (wind +8.5°)"
  └─ Waypoint ident, distance, wind correction angle

Weather Panel:
"WIND 270/15kt"
"DRIFT CORR +8.5°"
  └─ Wind direction/speed, correction angle
```

---

### Wind Triangle Examples

#### Example 1: Crosswind from Right

```
Desired track: 090° (east)
Wind: 180° at 20kt (from south)
TAS: 120kt

Calculation:
- Wind angle: 180 - 90 + 180 = 270° (90° perpendicular)
- Crosswind: 20 * sin(270°) = -20kt (full right crosswind)
- WCA: asin(-20/120) = -9.6°
- Heading: 090° - 9.6° = 080.4°

Result: Crab LEFT 9.6° to counter RIGHT crosswind
Ground track: 090° (maintains eastbound course)
```

#### Example 2: Headwind

```
Desired track: 360° (north)
Wind: 180° at 30kt (from south, headwind)
TAS: 120kt

Calculation:
- Wind angle: 180 - 360 + 180 = 0° (directly ahead)
- Crosswind: 30 * sin(0°) = 0kt (no crosswind)
- WCA: asin(0/120) = 0°
- Heading: 360° + 0° = 360°

Result: No heading correction needed
Ground speed: 120kt - 30kt = 90kt (reduced by headwind)
```

#### Example 3: Tailwind

```
Desired track: 270° (west)
Wind: 090° at 25kt (from east, tailwind)
TAS: 120kt

Calculation:
- Wind angle: 90 - 270 + 180 = 0° (directly behind)
- Crosswind: 25 * sin(0°) = 0kt (no crosswind)
- WCA: asin(0/120) = 0°
- Heading: 270° + 0° = 270°

Result: No heading correction needed
Ground speed: 120kt + 25kt = 145kt (increased by tailwind)
```

#### Example 4: Quartering Headwind

```
Desired track: 045° (northeast)
Wind: 315° at 15kt (from northwest, quartering headwind from left)
TAS: 120kt

Calculation:
- Wind angle: 315 - 45 + 180 = 450° → 90° (normalize)
- Crosswind: 15 * sin(90°) = 15kt (full left crosswind)
- WCA: asin(15/120) = +7.2°
- Heading: 045° + 7.2° = 052.2°

Result: Crab RIGHT 7.2° to counter LEFT crosswind
Ground track: 045° (maintains northeast course)
```

---

## Crosswind Components

### Crosswind Calculation

**Purpose:** Calculate crosswind and headwind components relative to runway or current heading.

**Formula:**
```javascript
// Crosswind component (perpendicular to runway/heading)
const crosswind = windSpeed * Math.sin(toRadians(windAngle));

// Headwind component (parallel to runway/heading)
const headwind = windSpeed * Math.cos(toRadians(windAngle));

// Wind angle relative to runway/heading
const windAngle = windDirection - runwayHeading;
```

**Sign Convention:**
- **Crosswind:**
  - Positive (+): Right crosswind
  - Negative (-): Left crosswind
- **Headwind:**
  - Positive (+): Headwind (reduces groundspeed)
  - Negative (-): Tailwind (increases groundspeed)

---

### Crosswind Examples

#### Example 1: Runway 09 (090°), Wind 180/20kt

```
Runway heading: 090° (east)
Wind: 180° at 20kt (from south)

Wind angle: 180 - 90 = 90° (perpendicular)

Crosswind: 20 * sin(90°) = 20kt (right crosswind)
Headwind: 20 * cos(90°) = 0kt (no headwind/tailwind)

Display: "X-WIND 20ktR · HEAD 0kt"
```

#### Example 2: Runway 27 (270°), Wind 230/15kt

```
Runway heading: 270° (west)
Wind: 230° at 15kt (from southwest)

Wind angle: 230 - 270 = -40°

Crosswind: 15 * sin(-40°) = -9.6kt (left crosswind)
Headwind: 15 * cos(-40°) = 11.5kt (headwind)

Display: "X-WIND 10ktL · HEAD 12kt"
```

#### Example 3: Runway 36 (360°), Wind 090/30kt

```
Runway heading: 360° (north)
Wind: 090° at 30kt (from east)

Wind angle: 90 - 360 = -270° → 90° (normalize)

Crosswind: 30 * sin(90°) = 30kt (right crosswind)
Headwind: 30 * cos(90°) = 0kt (no headwind/tailwind)

Display: "X-WIND 30ktR · HEAD 0kt"
```

#### Example 4: Runway 16 (160°), Wind 200/25kt

```
Runway heading: 160° (SSE)
Wind: 200° at 25kt (from SSW)

Wind angle: 200 - 160 = 40°

Crosswind: 25 * sin(40°) = 16.1kt (right crosswind)
Headwind: 25 * cos(40°) = 19.2kt (headwind)

Display: "X-WIND 16ktR · HEAD 19kt"
```

---

### Crosswind Limits

**Typical Aircraft Limits:**

| Aircraft | Max Demonstrated Crosswind |
|----------|---------------------------|
| Cessna 172 | 15kt |
| Cessna 152 | 12kt |
| SR22 | 20kt |
| Baron 58 | 17kt |
| King Air 350 | 30kt |
| TBM 930 | 25kt |

**AI Autopilot Handling:**
- **< 10kt**: Normal operations, minor crab angle
- **10-15kt**: Significant crab, increased workload
- **15-20kt**: Challenging, requires careful monitoring
- **> 20kt**: Exceeds most GA aircraft limits, consider alternate runway

**Warning Thresholds:**
```javascript
// In weather-panel.js
const crosswind = Math.abs(this._crosswindKt);
if (crosswind > 15) {
    this._showWarning('High crosswind: ' + crosswind.toFixed(0) + 'kt');
} else if (crosswind > 10) {
    this._showCaution('Moderate crosswind: ' + crosswind.toFixed(0) + 'kt');
}
```

---

## Turbulence Detection

### Vertical Speed Variance

**Method:** Monitor vertical speed (VS) variance over 10-sample window.

**Classification:**
- **Light turbulence**: σ(VS) > 100 fpm
- **Moderate turbulence**: σ(VS) > 250 fpm
- **Severe turbulence**: σ(VS) > 500 fpm

**Algorithm:**
```javascript
// In wind-compensation.js
detectTurbulence(verticalSpeed) {
    // Add to history (max 10 samples)
    this.vsHistory.push(verticalSpeed);
    if (this.vsHistory.length > 10) {
        this.vsHistory.shift();
    }

    // Need minimum samples
    if (this.vsHistory.length < 5) {
        return { level: 'none', stdDev: 0 };
    }

    // Calculate standard deviation
    const mean = this.vsHistory.reduce((a, b) => a + b, 0) / this.vsHistory.length;
    const variance = this.vsHistory.reduce((sum, vs) => {
        return sum + Math.pow(vs - mean, 2);
    }, 0) / this.vsHistory.length;
    const stdDev = Math.sqrt(variance);

    // Classify turbulence
    let level = 'none';
    if (stdDev > 500) level = 'severe';
    else if (stdDev > 250) level = 'moderate';
    else if (stdDev > 100) level = 'light';

    return { level, stdDev };
}
```

**Example:**
```
VS samples: [100, 150, -50, 200, -100, 150, -50, 100, 0, 50]

Mean: 55 fpm
Variance: Σ(vs - 55)² / 10
        = (45² + 95² + (-105)² + 145² + (-155)² + 95² + (-105)² + 45² + (-55)² + (-5)²) / 10
        = (2025 + 9025 + 11025 + 21025 + 24025 + 9025 + 11025 + 2025 + 3025 + 25) / 10
        = 92250 / 10 = 9225

Std Dev: √9225 = 96 fpm

Classification: NONE (< 100 fpm threshold)

---

VS samples: [300, -200, 400, -300, 200, -150, 350, -250, 100, -50]

Mean: 40 fpm
Variance: Σ(vs - 40)² / 10
        = (260² + (-240)² + 360² + (-340)² + 160² + (-190)² + 310² + (-290)² + 60² + (-90)²) / 10
        = (67600 + 57600 + 129600 + 115600 + 25600 + 36100 + 96100 + 84100 + 3600 + 8100) / 10
        = 624000 / 10 = 62400

Std Dev: √62400 = 250 fpm

Classification: MODERATE (250 fpm threshold)
```

---

### Turbulence Response

**AI Autopilot Actions:**

**Light Turbulence (100-250 fpm σ):**
- Continue normal operations
- Display weather panel with yellow indicator
- Log turbulence level

**Moderate Turbulence (250-500 fpm σ):**
- Reduce target speed by 5-10kt (turbulence penetration speed)
- Increase altitude hold tolerance (±200ft instead of ±100ft)
- Display weather panel with orange indicator
- Voice announcement: "Moderate turbulence detected"

**Severe Turbulence (>500 fpm σ):**
- Reduce speed to Va (maneuvering speed) or turbulence penetration speed
- Increase altitude hold tolerance (±300ft)
- Display weather panel with red indicator
- Voice announcement: "Severe turbulence - reducing speed"
- Log critical event

**Example:**
```javascript
// In rule-engine-core.js
_handleTurbulence(d, turbulence) {
    if (turbulence.level === 'severe') {
        // Reduce to turbulence penetration speed
        const targetSpeed = this._profile.speeds.va || (this._profile.speeds.cruise * 0.85);
        this._setTargetSpeed(targetSpeed, 'TURBULENCE_SEVERE');
        this._logCommand(`Severe turbulence (σ=${turbulence.stdDev.toFixed(0)} fpm), reducing speed to ${targetSpeed.toFixed(0)}kt`);
        this._voice?.speak('Severe turbulence detected, reducing speed');
    } else if (turbulence.level === 'moderate') {
        const targetSpeed = this._profile.speeds.cruise * 0.95;
        this._setTargetSpeed(targetSpeed, 'TURBULENCE_MODERATE');
        this._logCommand(`Moderate turbulence (σ=${turbulence.stdDev.toFixed(0)} fpm), reducing speed to ${targetSpeed.toFixed(0)}kt`);
    }
}
```

---

## Weather Panel UI

### Auto-Show Conditions

**Weather panel displays when:**
- Wind speed > 3kt
- Turbulence detected (light/moderate/severe)
- Crosswind > 5kt (during approach/landing)

**Manual Show/Hide:**
- Click "WX" button to toggle

---

### Panel Elements

**Display Format:**
```
┌─────────────────────────────────┐
│ WEATHER                         │
├─────────────────────────────────┤
│ WIND 270/15kt                   │  ← Wind direction/speed
│ X-WIND 12ktR · HEAD 9kt         │  ← Crosswind/headwind components
│ DRIFT CORR +8°                  │  ← Wind drift correction angle
│ TURBULENCE: MODERATE (σ=280fpm) │  ← Turbulence level + std dev
└─────────────────────────────────┘
```

**Color Coding:**
- **Wind badge**: Cyan (normal), Yellow (>10kt), Red (>20kt)
- **Crosswind**: Green (<5kt), Yellow (5-10kt), Orange (10-15kt), Red (>15kt)
- **Turbulence**: Yellow (light), Orange (moderate), Red (severe)

---

### Weather Panel Code

**HTML:**
```html
<div class="weather-panel" id="weather-panel" style="display:none">
    <div class="weather-header">WEATHER</div>
    <div class="weather-body">
        <span class="weather-wind" id="weather-wind">WIND ---/--kt</span>
        <span class="weather-components" id="weather-components">X-WIND --kt · H-WIND --kt</span>
        <span class="weather-correction" id="weather-correction">DRIFT CORR ---°</span>
        <span class="weather-turbulence" id="weather-turbulence"></span>
    </div>
</div>
```

**JavaScript:**
```javascript
// Update weather panel (called every frame)
_updateWeatherPanel(d) {
    // Wind display
    const windSpd = d.windSpeed || 0;
    const windDir = d.windDirection || 0;
    this.elements.weatherWind.textContent = `WIND ${windDir.toFixed(0).padStart(3, '0')}/${windSpd.toFixed(0)}kt`;

    // Wind badge color
    if (windSpd > 20) {
        this.elements.weatherWind.className = 'weather-wind wind-high';
    } else if (windSpd > 10) {
        this.elements.weatherWind.className = 'weather-wind wind-moderate';
    } else {
        this.elements.weatherWind.className = 'weather-wind wind-normal';
    }

    // Crosswind/headwind components
    const components = this._windComp.getCrosswindComponent(
        d.heading,
        windDir,
        windSpd
    );
    const xwindStr = Math.abs(components.crosswind).toFixed(0);
    const xwindDir = components.crosswind > 0 ? 'R' : 'L';
    const headwindStr = components.headwind > 0 ?
        `HEAD ${components.headwind.toFixed(0)}kt` :
        `TAIL ${Math.abs(components.headwind).toFixed(0)}kt`;

    this.elements.weatherComponents.textContent =
        `X-WIND ${xwindStr}kt${xwindDir} · ${headwindStr}`;

    // Drift correction
    const correction = this._windComp.calculateWindCorrection(
        d.track || d.heading,
        windDir,
        windSpd,
        d.airspeed || d.groundSpeed
    );
    this.elements.weatherCorrection.textContent =
        `DRIFT CORR ${correction >= 0 ? '+' : ''}${correction.toFixed(1)}°`;

    // Turbulence
    const turbulence = this._windComp.detectTurbulence(d.verticalSpeed || 0);
    if (turbulence.level !== 'none') {
        this.elements.weatherTurbulence.textContent =
            `TURBULENCE: ${turbulence.level.toUpperCase()} (σ=${turbulence.stdDev.toFixed(0)}fpm)`;
        this.elements.weatherTurbulence.className = `weather-turbulence turbulence-${turbulence.level}`;
    } else {
        this.elements.weatherTurbulence.textContent = '';
    }

    // Auto-show panel
    if (windSpd > 3 || turbulence.level !== 'none') {
        this.elements.weatherPanel.style.display = 'block';
    }
}
```

---

## Integration with Rule Engine

### Wind Compensation in Navigation

**Applied During:**
- CLIMB phase (tracking departure waypoints)
- CRUISE phase (following flight plan)
- DESCENT phase (tracking descent path)
- APPROACH phase (final approach course)

**Method:**
```javascript
// In rule-engine-core.js
_applyLateralNav(d, profile) {
    // Get nav guidance from GTN750
    const navGuidance = this._getNavGuidance();
    if (!navGuidance) {
        // No nav guidance, fly heading
        return;
    }

    // Calculate wind-corrected heading
    const desiredTrack = navGuidance.course;
    const windCorrection = this._windComp.calculateWindCorrection(
        desiredTrack,
        d.windDirection,
        d.windSpeed,
        d.airspeed
    );
    const correctedHeading = desiredTrack + windCorrection;

    // Steer to corrected heading
    this._steerToHeading(correctedHeading, d.heading, 'NAV_WIND_COMP');

    // Log in command log
    const waypoint = navGuidance.activeWaypoint;
    const distance = navGuidance.distanceNm;
    this._logCommand(`${waypoint} ${distance.toFixed(1)}nm (wind ${windCorrection >= 0 ? '+' : ''}${windCorrection.toFixed(1)}°)`);
}
```

---

### Turbulence Speed Reduction

**Applied During:**
- All phases except LANDING (speed already slow)

**Method:**
```javascript
// In rule-engine-core.js
_applyTurbulenceSpeed(d, profile, turbulence) {
    if (turbulence.level === 'none') return;

    // Determine target speed based on turbulence level
    let targetSpeed = this._targetSpeed;  // Current target

    if (turbulence.level === 'severe') {
        // Use Va (maneuvering speed) or 85% cruise
        targetSpeed = profile.speeds.va || (profile.speeds.cruise * 0.85);
    } else if (turbulence.level === 'moderate') {
        // Use 95% cruise speed
        targetSpeed = profile.speeds.cruise * 0.95;
    } else if (turbulence.level === 'light') {
        // Use 98% cruise speed (minor reduction)
        targetSpeed = profile.speeds.cruise * 0.98;
    }

    // Apply speed reduction
    this._setTargetSpeed(targetSpeed, `TURBULENCE_${turbulence.level.toUpperCase()}`);
}
```

---

## API Reference

### WindCompensation Class

**File:** `ui/ai-autopilot/modules/wind-compensation.js` (~190 lines)

**Constructor:**
```javascript
const windComp = new WindCompensation();
```

---

### Methods

#### calculateWindCorrection(track, windDir, windSpd, tas)

Calculate heading correction angle for wind drift.

**Parameters:**
- `track` (number): Desired ground track (°)
- `windDir` (number): Wind direction (° from)
- `windSpd` (number): Wind speed (kt)
- `tas` (number): True airspeed (kt)

**Returns:** (number) Wind correction angle (°)

**Example:**
```javascript
const wca = windComp.calculateWindCorrection(
    090,   // Desired track: east
    180,   // Wind: from south
    20,    // Wind speed: 20kt
    120    // TAS: 120kt
);
// Returns: -9.6° (crab left to counter right crosswind)
```

---

#### getCrosswindComponent(heading, windDir, windSpd)

Calculate crosswind and headwind components.

**Parameters:**
- `heading` (number): Aircraft/runway heading (°)
- `windDir` (number): Wind direction (° from)
- `windSpd` (number): Wind speed (kt)

**Returns:** (object) `{ crosswind, headwind }`
- `crosswind` (number): Crosswind component (kt), positive = right, negative = left
- `headwind` (number): Headwind component (kt), positive = headwind, negative = tailwind

**Example:**
```javascript
const components = windComp.getCrosswindComponent(
    090,   // Runway 09 heading
    180,   // Wind from south
    20     // 20kt
);
// Returns: { crosswind: 20, headwind: 0 }
```

---

#### detectTurbulence(verticalSpeed)

Detect turbulence based on vertical speed variance.

**Parameters:**
- `verticalSpeed` (number): Current vertical speed (fpm)

**Returns:** (object) `{ level, stdDev }`
- `level` (string): 'none', 'light', 'moderate', 'severe'
- `stdDev` (number): Standard deviation of vertical speed (fpm)

**Example:**
```javascript
const turbulence = windComp.detectTurbulence(250);
// Call every frame with current VS
// Returns after 5+ samples: { level: 'moderate', stdDev: 280 }
```

---

#### reset()

Reset turbulence detection history.

**Example:**
```javascript
windComp.reset();
// Clears VS history, useful after phase change or manual reset
```

---

## Examples

### Example 1: Cross-Country Flight with Wind

**Scenario:** KDEN to KCOS (Denver to Colorado Springs), 70nm south

**Flight Plan:**
- Departure: KDEN (39.86°N, 104.67°W)
- Destination: KCOS (38.81°N, 104.70°W)
- Distance: 70nm
- Track: 180° (due south)
- TAS: 120kt
- Wind: 270° at 25kt (west wind, blowing east)

**Wind Calculation:**
```
Wind angle: 270 - 180 + 180 = 270° (90° perpendicular)
Crosswind: 25 * sin(270°) = -25kt (full left crosswind)
WCA: asin(-25/120) = +12.0°
Heading: 180° + 12.0° = 192°

Result: Fly heading 192° (SSE) to maintain ground track 180° (south)
```

**Timeline:**
```
T+0s:   Depart KDEN, climb to 8,500ft
        Phase: CLIMB
        Wind comp active

T+300s: Level at 8,500ft
        Phase: CRUISE
        Heading: 192° (12° crab angle)
        Ground track: 180° (maintaining southbound course)

        Weather Panel:
        "WIND 270/25kt"
        "X-WIND 25ktL · TAIL 0kt"
        "DRIFT CORR +12.0°"

        Command Log:
        "KCOS 65.3nm (wind +12.0°)"

T+1800s: Top of descent (30nm from KCOS)
         Phase: DESCENT
         Wind comp still active
         Heading: 192° (maintaining crab)

T+2400s: Final approach
         Phase: APPROACH
         Heading: 192° → 180° (remove crab on final)
         Crosswind landing on Runway 17L
```

---

### Example 2: Moderate Turbulence Response

**Scenario:** Climbing through mountain wave turbulence

**Initial Conditions:**
- Phase: CLIMB
- Target altitude: 12,000ft
- Current: 8,500ft
- Climb speed: 85kt (Vy)
- VS: +700 fpm (normal climb)

**Turbulence Onset:**
```
T+0s:   VS: +700 fpm (normal)
        Turbulence: NONE

T+10s:  VS: +850 fpm
        Turbulence: NONE (insufficient samples)

T+20s:  VS: +550 fpm
        Turbulence: NONE

T+30s:  VS: +900 fpm
        Turbulence: NONE

T+40s:  VS: +400 fpm (sudden drop)
        Turbulence: LIGHT (σ=150 fpm)

        Weather Panel shows: "TURBULENCE: LIGHT (σ=150fpm)"

T+50s:  VS: +1000 fpm (updraft)
        Turbulence: MODERATE (σ=280 fpm)

        AI Response:
        - Reduce speed: 85kt → 81kt (95% cruise)
        - Increase alt tolerance: ±100ft → ±200ft
        - Voice: "Moderate turbulence detected"

        Weather Panel: "TURBULENCE: MODERATE (σ=280fpm)" (orange)

T+60s:  VS: +200 fpm (downdraft)
        Turbulence: SEVERE (σ=520 fpm)

        AI Response:
        - Reduce speed: 81kt → 70kt (Va, maneuvering speed)
        - Increase alt tolerance: ±200ft → ±300ft
        - Voice: "Severe turbulence - reducing speed"

        Weather Panel: "TURBULENCE: SEVERE (σ=520fpm)" (red)

T+120s: VS stabilizes around +600 fpm
        Turbulence: MODERATE (σ=240 fpm)

        AI Response:
        - Resume normal speed: 70kt → 81kt
        - Altitude tolerance: ±300ft → ±200ft

T+180s: VS normal +700 fpm
        Turbulence: NONE (σ=80 fpm)

        AI Response:
        - Resume climb speed: 81kt → 85kt
        - Altitude tolerance: ±200ft → ±100ft
        - Weather panel hides
```

---

### Example 3: Crosswind Landing

**Scenario:** Landing at KDEN Runway 16R with crosswind

**Conditions:**
- Runway: 16R (heading 163°)
- Wind: 230° at 18kt (from SW)
- Aircraft: Cessna 172
- Crosswind limit: 15kt

**Crosswind Calculation:**
```
Wind angle: 230 - 163 = 67°
Crosswind: 18 * sin(67°) = 16.6kt (LEFT crosswind)
Headwind: 18 * cos(67°) = 7.0kt (headwind)

Result: 17kt left crosswind, 7kt headwind
WARNING: Crosswind exceeds C172 limit (15kt)!
```

**Timeline:**
```
T-300s: APPROACH phase, 10nm from runway

        Weather Panel shows:
        "WIND 230/18kt"
        "X-WIND 17ktL · HEAD 7kt"

        WARNING: "High crosswind: 17kt (limit 15kt)"

        Voice: "Caution - crosswind exceeds aircraft limits"

        Pilot Decision:
        - Option 1: Continue, accept challenging landing
        - Option 2: Request Runway 25 (closer to wind direction)
        - Option 3: Divert to alternate

T-120s: Final approach, 3nm from runway
        Heading: 170° (7° crab angle to counter crosswind)
        Ground track: 163° (aligned with runway)

        AI maintains crab angle until short final

T-30s:  Short final, 0.5nm from runway
        AI transitions to wing-low method:
        - Remove crab (heading → 163°)
        - Apply left aileron (lower left wing into wind)
        - Apply right rudder (maintain runway centerline)

T-10s:  Over threshold
        Speed: 70kt (Vref 65kt + 5kt gust factor)
        Configuration: Full flaps, gear down

T+0s:   Touchdown
        - Left main gear first (wing-low)
        - Right main gear
        - Nosewheel
        - Full rudder deflection to maintain centerline

        Rollout: Maintain centerline with rudder, aileron into wind
```

---

## Troubleshooting

### "Wind correction not applied"

**Symptoms:** AI flies direct heading instead of correcting for wind, drifts off course

**Causes:**
1. Wind speed < 1kt (below threshold)
2. Aircraft speed < 50kt (threshold not met)
3. NAV mode not active (HDG mode instead)
4. Wind data not available from SimConnect

**Solutions:**
1. Check wind speed in weather panel: must be >1kt
2. Check aircraft speed: must be >50kt for wind comp
3. Verify NAV mode active (tracking GPS waypoints)
4. Check SimConnect wind data:
   ```javascript
   console.log(flightData.windDirection, flightData.windSpeed);
   ```
5. If wind data missing, MSFS weather system may be disabled

---

### "Turbulence detection always shows 'none'"

**Symptoms:** Flying through obvious turbulence, weather panel shows no turbulence

**Causes:**
1. Insufficient VS samples (<5 samples needed)
2. VS variance below 100 fpm threshold
3. VS data not updating from SimConnect

**Solutions:**
1. Wait 10-15 seconds for sample collection
2. Check VS variance manually:
   ```javascript
   console.log(windComp.vsHistory);
   // Should show varying VS values
   ```
3. Verify VS data updating:
   ```javascript
   console.log(flightData.verticalSpeed);
   // Should change over time
   ```
4. If VS data frozen, restart SimConnect connection

---

### "Crosswind component shows 0kt when wind present"

**Symptoms:** Wind speed >0kt, but crosswind shows 0kt

**Causes:**
1. Wind directly aligned with heading (wind angle 0° or 180°)
2. Heading data not available
3. getCrosswindComponent() called with incorrect parameters

**Solutions:**
1. Check wind angle: should be 0° (headwind) or 180° (tailwind) for 0 crosswind
   ```javascript
   const windAngle = (windDirection - heading + 360) % 360;
   console.log('Wind angle:', windAngle);
   ```
2. Verify heading data:
   ```javascript
   console.log(flightData.heading);
   // Should match current aircraft heading
   ```
3. Verify parameters:
   ```javascript
   windComp.getCrosswindComponent(heading, windDir, windSpd);
   // NOT: windComp.getCrosswindComponent(windDir, heading, windSpd)
   ```

---

### "Severe turbulence doesn't reduce speed"

**Symptoms:** Turbulence level shows SEVERE, but AI maintains cruise speed

**Causes:**
1. Speed reduction disabled in tuning panel
2. Aircraft profile missing Va (maneuvering speed)
3. LANDING phase (speed already slow)

**Solutions:**
1. Check tuning panel: turbulence response should be enabled
2. Add Va to aircraft profile:
   ```javascript
   speeds: {
       cruise: 120,
       va: 98,  // Maneuvering speed
       ...
   }
   ```
3. If in LANDING phase, speed reduction not applied (already at Vref)

---

### "Weather panel won't show/hide"

**Symptoms:** Weather panel stuck visible or hidden

**Causes:**
1. Manual show/hide via WX button
2. Auto-show threshold not met (wind <3kt, no turbulence)
3. CSS display override

**Solutions:**
1. Click WX button to toggle manual show/hide
2. Check conditions:
   - Wind speed: `d.windSpeed > 3`
   - Turbulence: `turbulence.level !== 'none'`
3. Check CSS:
   ```javascript
   elements.weatherPanel.style.display = 'block';
   // Should show panel
   ```

---

## Performance

**Computational Cost:**
- Wind correction: ~0.1ms/frame (trigonometry)
- Crosswind components: ~0.05ms/frame (2x trigonometry)
- Turbulence detection: ~0.2ms/frame (variance calculation, 10 samples)
- **Total:** <1ms/frame (negligible overhead)

**Memory:**
- WindCompensation class: ~10KB
- VS history buffer: 10 samples × 8 bytes = 80 bytes
- **Total:** <15KB

**Network:**
- No network requests (all client-side calculations)

---

## Limitations

1. **GPS altitude only** - Uses GPS altitude, not pressure altitude (minor inaccuracy)
2. **No wind shear detection** - Cannot detect rapid wind changes at low altitude
3. **Simple turbulence model** - VS variance only, doesn't account for lateral gusts
4. **No icing detection** - Cannot detect ice accumulation or warn of icing conditions
5. **No visibility/ceiling warnings** - Doesn't alert for low visibility or ceilings
6. **Wind data from MSFS** - Accuracy depends on MSFS weather system fidelity

---

## Future Enhancements

**Potential Improvements:**
- Wind shear detection (rapid wind change alerts)
- Icing detection and warnings
- Visibility/ceiling monitoring with minimums alerts
- Advanced turbulence model (lateral + vertical gusts)
- Weather radar simulation (precipitation detection)
- METAR/TAF integration (forecast vs actual comparison)
- Pressure altitude corrections (QNH-based calculations)

---

## Credits

- **MSFS 2024** - SimConnect weather data
- **FAA** - Wind triangle formulas, turbulence classification
- **SimGlass Team** - Framework and integration

---

## License

Part of SimGlass - see main repository LICENSE file.

---

## See Also

- [README.md](README.md) - Main AI Autopilot documentation
- [ATC-GUIDE.md](ATC-GUIDE.md) - ATC ground operations
- [NAVIGATION-GUIDE.md](NAVIGATION-GUIDE.md) - Flight plan tracking *(coming soon)*
- [PHASES-GUIDE.md](PHASES-GUIDE.md) - 8 flight phases *(coming soon)*
- [LLM-ADVISOR-GUIDE.md](LLM-ADVISOR-GUIDE.md) - AI suggestions *(coming soon)*
