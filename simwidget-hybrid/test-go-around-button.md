# GO AROUND Button Visual Test

## Test URL
http://192.168.1.42:8080/ui/gtn750/

## Test Steps

### Test 1: Approach WITH missed approach (should show button)
1. Open GTN750: http://192.168.1.42:8080/ui/gtn750/
2. Click PROC tab at bottom
3. Click APPROACH tab
4. Enter airport: KBIH
5. Click procedure "R12-Z" (Runway: R, Transition: R)
6. Procedure details panel should open
7. **Expected**: GO AROUND button visible at bottom of panel (orange/amber button)
8. **Expected**: Button shows "⟲ GO AROUND" text

### Test 2: Approach WITHOUT missed approach (should NOT show button)
1. Stay in PROC > APPROACH
2. Enter airport: KDEN
3. Click any simple approach (e.g., H07-Z)
4. Procedure details panel should open
5. **Expected**: NO GO AROUND button visible

### Test 3: Departure/Arrival (should NOT show button)
1. Click DEPARTURE or ARRIVAL tab
2. Select any procedure
3. **Expected**: NO GO AROUND button visible (only for approaches)

### Test 4: Button Click (functional test)
1. Go back to KBIH R12-Z (with missed approach)
2. Click the GO AROUND button
3. **Expected**:
   - Panel closes
   - Console log shows "Activating missed approach with 3 waypoints"
   - Console log shows "Missed approach activated"

## Visual Verification

The GO AROUND button should have:
- Orange/amber gradient background (#aa6600 to #ff8800)
- Amber border (#ffaa00)
- Dark text on light background
- Circular arrow icon (⟲)
- "GO AROUND" text in uppercase
- Hover effect: brighter color, slight lift
- Full width within its container

## Console Commands for Manual Testing

```javascript
// Check if missed approach data is loaded
console.log('Missed approach waypoints:', window.procPage?.missedApproachWaypoints);

// Force show GO AROUND button (for testing CSS)
document.getElementById('proc-missed-controls').style.display = 'block';

// Check button styling
const btn = document.getElementById('proc-go-around-btn');
console.log('Button styles:', window.getComputedStyle(btn));
```

## Expected API Response for KBIH R12-Z

```json
{
  "procedure": { "id": 10489, "ident": "R12-Z", "type": "APPROACH", "runway": "R" },
  "waypoints": [
    { "ident": "HEGIT", "pathTerm": "IF", ... },
    { "ident": "MUBOE", "pathTerm": "TF", ... },
    ...
    { "ident": "TEVOC", "pathTerm": "TF", ... }
  ],
  "hasMissedApproach": true,
  "missedApproachWaypoints": [
    { "ident": "NEBSE", "pathTerm": "TF", "type": "MISSED", ... },
    { "ident": "BIH", "pathTerm": "TF", "type": "MISSED", ... },
    { "ident": "BIH", "pathTerm": "HM", "type": "MISSED", ... }
  ]
}
```

## Known Issues / Notes

- Button only appears for APPROACH procedures with missed approach data
- Clicking GO AROUND calls onProcedureLoad callback - flight plan integration in Task #9
- Console logging enabled for debugging
