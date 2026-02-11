# ATC Phraseology Reference

Standard ICAO/FAA phraseology for the ATC bot. All phrases must be followed by readback validation.

## Ground Operations

### Taxi Clearance
```
ATC: "{callsign}, taxi to runway {rwy} via {taxiways}, hold short runway {rwy}"
Example: "November one two three four five, taxi to runway two four right via Alpha, Bravo, hold short runway two four right"

Required Readback: callsign + runway + taxiways
Pilot: "Taxi two four right via Alpha Bravo, hold short, November three four five"
```

### Progressive Taxi
```
ATC: "{callsign}, taxi via {taxiway}"
ATC: "{callsign}, continue taxi via {taxiway}"
ATC: "{callsign}, hold position"
```

### Position Verification
```
ATC: "{callsign}, verify position"
ATC: "{callsign}, confirm on taxiway {name}"
Pilot: "On taxiway {name}, {callsign}"
```

### Crossing Clearances
```
ATC: "{callsign}, cross runway {rwy}"
Required Readback: callsign + "cross runway" + runway
```

## Takeoff/Landing

### Hold Short
```
ATC: "{callsign}, hold short runway {rwy}"
Required Readback: callsign + "hold short" + runway
```

### Takeoff Clearance
```
ATC: "{callsign}, runway {rwy}, cleared for takeoff"
Required Readback: callsign + runway + "cleared for takeoff"
```

### Landing Clearance
```
ATC: "{callsign}, runway {rwy}, cleared to land"
Required Readback: callsign + runway + "cleared to land"
```

### Go Around
```
ATC: "{callsign}, go around"
Required Readback: callsign + "going around"
```

## Taxi Instructions - Special Cases

### Turn Instructions
```
ATC: "{callsign}, make a left/right turn {taxiway}"
```

### Speed Restrictions
```
ATC: "{callsign}, reduce speed to minimum"
ATC: "{callsign}, expedite taxi"
```

### Give Way Instructions
```
ATC: "{callsign}, give way to {traffic} on your {left/right}"
```

## Readback Errors

### Incorrect Readback
```
ATC: "Negative, {correction}. I say again, {clearance}"
ATC: "Readback incorrect, {correction}"
```

### Verify Specific Item
```
ATC: "Confirm runway {rwy}"
ATC: "Verify via {taxiways}"
```

## Numbers & Letters

### Phonetic Alphabet
```
A - Alfa        N - November
B - Bravo       O - Oscar
C - Charlie     P - Papa
D - Delta       Q - Quebec
E - Echo        R - Romeo
F - Foxtrot     S - Sierra
G - Golf        T - Tango
H - Hotel       U - Uniform
I - India       V - Victor
J - Juliet      W - Whiskey
K - Kilo        X - X-ray
L - Lima        Y - Yankee
M - Mike        Z - Zulu
```

### Numbers (Pronunciation)
```
0 - Zero        6 - Six
1 - One         7 - Seven
2 - Two         8 - Eight
3 - Three       9 - Niner
4 - Four        . - Decimal
5 - Five        100 - One hundred
```

### Runway Designation
```
16L → "one six left"
24R → "two four right"
09  → "zero niner"
```

### Altitudes
```
3000 ft → "three thousand"
10000 ft → "one zero thousand"
FL350 → "flight level three five zero"
```

### Headings
```
090° → "heading zero niner zero"
270° → "heading two seven zero"
```

## Callsigns

### General Aviation
```
N12345 → "November one two three four five"
N345AB → "November three four five alfa bravo"
```

### Airlines
```
AAL123 → "American one two three"
UAL456 → "United four five six"
```

### Abbreviations (when known)
```
N12345 (after initial contact) → "November three four five"
```

## Standard Responses

### Acknowledgments
```
"Roger" - Message received and understood
"Wilco" - Will comply
"Affirmative" - Yes
"Negative" - No
"Say again" - Repeat your message
"Standby" - Wait
"Unable" - Cannot comply
```

### Position Reports
```
"{callsign}, holding short runway {rwy}"
"{callsign}, ready for departure"
"{callsign}, on the roll"
"{callsign}, airborne"
```

## Emergency Phraseology

### Distress
```
"Mayday, Mayday, Mayday, {callsign}"
Squawk: 7700
```

### Urgency
```
"Pan-Pan, Pan-Pan, Pan-Pan, {callsign}"
```

### Immediate Priority
```
"{callsign}, request priority handling"
```

## Bot Implementation Notes

### Critical Readback Items
Always require readback for:
- Runway assignments (takeoff/landing/crossing)
- Hold short instructions
- Altitude assignments
- Heading assignments
- Frequency changes

### Validation Logic
```csharp
bool ValidateReadback(string readback, string clearance) {
    // Must include:
    // 1. Callsign (or abbreviated)
    // 2. All numbers (runway, altitude, heading)
    // 3. Critical action words (hold short, cleared, via)
    
    return hasCallsign && hasRunway && hasAction;
}
```

### Text-to-Speech Conversion
```
"16R" → "one six right"
"24L" → "two four left"  
"Alpha" → "alfa"
"9" → "niner"
"." → "decimal"
```

### Speech-to-Text Parsing
```
"one six right" → "16R"
"two four left" → "24L"
"alfa" → "Alpha" or "A"
"niner" → "9"
```

## Frequency Management

### Handoff Phraseology
```
ATC: "{callsign}, contact ground on {freq}"
Required Readback: callsign + frequency

ATC: "{callsign}, contact tower on {freq}"
ATC: "{callsign}, contact departure on {freq}"
```

### Frequency Format
```
121.9 → "one two one point niner"
118.75 → "one one eight point seven five"
```

## Common Scenarios

### Scenario 1: Simple Taxi
```
ATC: "November one two three four five, taxi to runway one six right via Alpha, Bravo, hold short one six right"
Pilot: "Taxi one six right via Alpha Bravo, hold short, November three four five"
ATC: "November three four five, readback correct"
```

### Scenario 2: Readback Error
```
ATC: "November one two three four five, taxi to runway two four left via Charlie, Delta"
Pilot: "Taxi two four right via Charlie Delta, November three four five"
ATC: "Negative, runway two four LEFT. Taxi to runway two four left via Charlie, Delta"
Pilot: "Taxi two four left via Charlie Delta, November three four five"
ATC: "Readback correct"
```

### Scenario 3: Progressive Taxi
```
ATC: "November one two three four five, taxi via Echo"
Pilot: "Via Echo, November three four five"
[Aircraft reaches Echo]
ATC: "November three four five, continue via Alpha"
Pilot: "Continue Alpha, November three four five"
```

### Scenario 4: Position Check
```
ATC: "November three four five, verify position"
Pilot: "On taxiway Bravo approaching Charlie, November three four five"
ATC: "Roger, continue taxi via Charlie, Bravo, hold short runway two four right"
```

## Reference Standards

- **ICAO Annex 10**: Aeronautical Telecommunications
- **FAA Order JO 7110.65**: Air Traffic Control
- **FAA AIM Chapter 4**: Air Traffic Control

## Implementation Checklist

- [ ] All clearances generate proper phraseology
- [ ] Readback validation enforced for critical items
- [ ] Numbers converted to words for TTS
- [ ] Phonetic alphabet used for letters
- [ ] Runway designators properly formatted
- [ ] Callsign abbreviation after first contact
- [ ] Position verification on route deviation
- [ ] Progressive taxi for complex routes
