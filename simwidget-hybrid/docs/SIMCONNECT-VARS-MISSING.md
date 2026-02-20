# SimConnect Variables — What We're Missing

Reference of useful SimConnect SimVars NOT in our current data stream.
Compared against our 180 registered variables (as of Feb 2026).

---

## Currently Reading (180 vars)

**Core (14):** Altitude, AGL, Ground Alt, IAS, Heading Mag, VS, Ground Speed, Lat, Lon, Pitch, Bank, MagVar, Wind Dir, Wind Vel
**Weather (7):** Temp, Pressure, Sea Level Pressure, Visibility, Precip Rate, In Cloud, Density Alt
**Time (2):** Local, Zulu
**Autopilot (17):** Master, HDG Lock/Dir, ALT Lock/Var, VS Hold/Var, SPD Hold/Var, NAV1 Lock, APR Hold, BC Hold, FLC, Yaw Damper, Throttle Arm, Wing Leveler, FD Active
**GPS (14):** WP Count/Index/Distance/ETE/Bearing, Pos Lat/Lon, ETE, CDI Needle, Cross Trk, Desired Trk, OBS, Vert Angle Err, Approach Mode
**Fuel (25):** Total Qty/Cap, Flow GPH:1, 11 Tank Quantities, 11 Tank Capacities
**Engine (14):** Combustion:1, Throttle:1, RPM:1, MAP:1, Oil Temp/Press:1, EGT/CHT:1, Prop:1, Mixture:1, N1/N2:1, Num Engines, Engine Type
**NAV (14):** NAV1 CDI/OBS/Radial/ToFrom/Signal/GSI/GS Flag/Has LOC/Has GS, NAV2 CDI/OBS/Radial/ToFrom/Signal
**Radio (13):** COM1/2 Active+Stby, NAV1/2 Active+Stby, ADF1 Active+Stby, XPDR Code/State/Ident
**DME (4):** NAV DME:1/:2, DME Speed:1/:2
**Lights (10):** Nav, Beacon, Strobe, Landing, Taxi, Cabin, Recognition, Wing, Logo, Panel
**Gear/Flaps (6):** Gear Handle, Gear Pos:0/1/2, Flaps Index, Flaps Pct, Parking Brake
**Immersion (15):** Accel X/Y/Z, Alpha/Beta, On Ground, Surface Type, Stall/Overspeed Warn, Gear Pos:0/1/2, Flaps Pct, Rotation Vel X/Z
**Doors (5):** Canopy, Exit:0/1/2/3
**Controls (6):** Elevator/Aileron/Rudder Pos, Yoke Y/X, Rudder Pedal
**Trim (4):** Elev Trim Pos/Pct, Aileron Trim Pct, Rudder Trim Pct
**Extended (8):** TAS, Mach, True Heading, VS0/VS1/VC, Total/Empty Weight
**Electrical (4):** Master Battery, Main Bus V, Avionics Bus V, Battery Load
**Brakes (2):** Left/Right Position
**Pitot/Vacuum (2):** Pitot Heat, Vacuum Pressure
**Sim (2):** Sim Rate, Camera State
**Barometer (2):** Kohlsman MB, Barometer Pressure
**Misc (2):** Radio Height, Total Air Temp

---

## High Value — Added to Server

### Flight Model & Performance (11 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `G FORCE` | GForce | Float | G-load — immersion, AI safety limits |
| `DYNAMIC PRESSURE` | PSF | Float | Aerodynamic pressure (q-bar) |
| `DESIGN TAKEOFF SPEED` | Knots | Float | Recommended Vr |
| `DESIGN SPEED CLIMB` | feet per second | Float | Best climb speed |
| `DESIGN CRUISE ALT` | Feet | Float | Optimal cruise altitude |
| `DECISION HEIGHT` | Feet | Float | DH for approach minimums |
| `DECISION ALTITUDE MSL` | Feet | Float | DA for approach minimums |
| `CG PERCENT` | Percent | Float | Longitudinal CG position |
| `CG PERCENT LATERAL` | Percent | Float | Lateral CG position |
| `MAX GROSS WEIGHT` | Pounds | Float | MTOW |
| `WING SPAN` | Feet | Float | Aircraft wingspan |

### Autopilot Advanced (8 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `AUTOPILOT FLIGHT DIRECTOR BANK` | Radians | Float | FD commanded bank |
| `AUTOPILOT FLIGHT DIRECTOR PITCH` | Radians | Float | FD commanded pitch |
| `AUTOPILOT MANAGED THROTTLE ACTIVE` | Bool | Bool | Autothrottle engaged |
| `AUTOPILOT TAKEOFF POWER ACTIVE` | Bool | Bool | TOGA mode |
| `AUTOPILOT MACH HOLD VAR` | Number | Float | Target mach number |
| `AUTOPILOT SPEED SLOT INDEX` | Number | Int | Managed vs selected speed |
| `AUTOPILOT ALTITUDE SLOT INDEX` | Number | Int | Managed vs selected alt |
| `AUTOPILOT VS SLOT INDEX` | Number | Int | Managed vs selected VS |

### Aircraft Systems (10 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `STRUCTURAL ICE PCT` | Percent Over 100 | Float | Airframe ice accumulation |
| `PITOT ICE PCT` | Percent Over 100 | Float | Pitot tube icing |
| `PRESSURIZATION CABIN ALTITUDE` | Feet | Float | Cabin altitude |
| `PRESSURIZATION PRESSURE DIFFERENTIAL` | PSF | Float | Cabin pressure diff |
| `WARNING FUEL` | Bool | Bool | Low fuel annunciator |
| `WARNING OIL PRESSURE` | Bool | Bool | Oil pressure annunciator |
| `WARNING VACUUM` | Bool | Bool | Vacuum annunciator |
| `WARNING VOLTAGE` | Bool | Bool | Voltage annunciator |
| `ON ANY RUNWAY` | Bool | Bool | On a runway |
| `CRASH FLAG` | Enum | Int | Crash cause indicator |

### Gear & Brakes (6 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `GEAR TOTAL PCT EXTENDED` | Percent | Float | Overall gear extension % |
| `GEAR IS ON GROUND:0` | Bool | Bool | Nose gear on ground |
| `GEAR SPEED EXCEEDED` | Bool | Bool | Gear overspeed |
| `ANTISKID BRAKES ACTIVE` | Bool | Bool | Antiskid system |
| `AUTOBRAKES ACTIVE` | Bool | Bool | Autobrake state |
| `NOSEWHEEL LOCK ON` | Bool | Bool | Nosewheel steering lock |

### Markers & Navigation (5 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `MARKER BEACON STATE` | Enum | Int | 0=None 1=OM 2=MM 3=IM |
| `INNER MARKER` | Bool | Bool | Inner marker active |
| `MIDDLE MARKER` | Bool | Bool | Middle marker active |
| `OUTER MARKER` | Bool | Bool | Outer marker active |
| `ADF RADIAL:1` | Degrees | Float | ADF bearing to NDB |

### Flaps & Spoilers (4 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `FLAP SPEED EXCEEDED` | Bool | Bool | Flap overspeed |
| `SPOILERS LEFT POSITION` | Position | Int | Left spoiler (0-16383) |
| `SPOILERS RIGHT POSITION` | Position | Int | Right spoiler (0-16383) |
| `SPOILER AVAILABLE` | Bool | Bool | Has spoiler system |

### Electrical Advanced (4 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `ELECTRICAL TOTAL LOAD AMPS` | Amperes | Float | Total electrical load |
| `ELECTRICAL BATTERY ESTIMATED CAPACITY PCT` | Percent | Float | Battery state of charge |
| `APU PCT RPM` | Percent Over 100 | Float | APU speed |
| `EXTERNAL POWER ON` | Bool | Bool | GPU connected |

---

## Medium Value — Helicopter Support (8 vars)

| Variable | Unit | Type | Description |
|----------|------|------|-------------|
| `ROTOR RPM:1` | RPM | Float | Main rotor speed |
| `ROTOR RPM PCT:1` | Percent Over 100 | Float | Rotor % of max rated |
| `COLLECTIVE POSITION` | Percent Over 100 | Float | Collective input |
| `ROTOR CLUTCH ACTIVE` | Bool | Bool | Rotor clutch engaged |
| `ROTOR GOV ACTIVE:1` | Bool | Bool | Governor active |
| `ROTOR CHIP DETECTED` | Bool | Bool | Chip detector warning |
| `TAIL ROTOR PEDAL POSITION` | Percent Over 100 | Float | Anti-torque input |
| `ROTOR TEMPERATURE` | Rankine | Float | Transmission temp |

---

## Not Added — String Variables (Separate Data Definition Required)

These require STRING256 type, which breaks our FLOAT64 buffer alignment.
Would need a **second data definition** (ID 15+) with its own read cycle.

| Variable | Type | Description |
|----------|------|-------------|
| `TITLE` | String | Aircraft name from aircraft.cfg |
| `ATC TYPE` | String | ATC aircraft type code |
| `ATC MODEL` | String | ATC aircraft model code |
| `CATEGORY` | String | Airplane/Helicopter/Boat/etc |

---

## Not Added — Lower Priority

These are available but not worth the buffer space for our use cases:

- **Helicopter sling ops** — SLING vars, only for cargo missions
- **Carrier ops** — TAILHOOK, LAUNCHBAR, only for military
- **Combat** — BOMB/CANNON/GUN/ROCKET AMMO
- **Ornithopter** — specialty aircraft
- **Detailed gear steering** — STEER ANGLE per wheel
- **Wheel RPM** — per-wheel rotation speeds
- **Water rudder** — floatplane only
- **Contact points** — 20 indexed compression/skid points
- **Fuel system plumbing** — FUELSYSTEM PUMP/VALVE/LINE/JUNCTION
- **Circuit breakers** — individual CIRCUIT/BREAKER states
- **Detailed control surfaces** — per-side flap/aileron deflection angles
- **Velocity vectors** — VELOCITY WORLD X/Y/Z
- **Payload stations** — individual baggage/pax weights

---

## Sources

- [MSFS 2024 SimVars](https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/SimVars/Simulation_Variables.htm)
- [Helicopter Variables](https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Helicopter_Variables.htm)
- [Aircraft Engine Variables](https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_Engine_Variables.htm)
- [Flight Model Variables](https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/SimVars/Aircraft_SimVars/Aircraft_FlightModel_Variables.htm)
- [Aircraft System Variables](https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_System_Variables.htm)
- [Brake/Landing Gear Variables](https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_Brake_Landing_Gear_Variables.htm)
- [Autopilot Variables](https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_AutopilotAssistant_Variables.htm)
