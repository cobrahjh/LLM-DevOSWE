# SimConnect Events Reference

Complete catalog of SimConnect Key Events that can be sent to MSFS 2020/2024 via `transmitClientEvent`.

## Events vs SimVars

| Aspect | Key Events | SimVars (SetDataOnSimObject) |
|--------|-----------|------------------------------|
| **Purpose** | Trigger actions/controls | Set state directly |
| **Usage** | `transmitClientEvent` | `setDataOnSimObject` |
| **Example** | `GEAR_TOGGLE` | `GEAR HANDLE POSITION` |
| **When** | Controls, switches, increments | Direct state changes |

**Rule:** Check if a writable SimVar exists first. If not, use the corresponding Key Event.

---

## 1. Autopilot

### Master Controls
| Event | Param | Notes |
|-------|-------|-------|
| `AP_MASTER` | — | Toggle autopilot on/off |
| `AUTOPILOT_ON` / `AUTOPILOT_OFF` | — | Explicit AP control |
| `AUTOPILOT_DISENGAGE_TOGGLE` | — | Toggle AP disengage |

### Heading Mode
| Event | Param | Notes |
|-------|-------|-------|
| `AP_HDG_HOLD` / `_ON` / `_OFF` | — | Heading hold mode |
| `AP_PANEL_HEADING_SET` | bool | Panel heading mode |
| `HEADING_SLOT_INDEX_SET` | index | Set heading slot index |

### Altitude Mode
| Event | Param | Notes |
|-------|-------|-------|
| `AP_ALT_HOLD` / `_ON` / `_OFF` | — | Altitude hold |
| `AP_ALT_VAR_SET_ENGLISH` | feet, index | Set altitude in feet |
| `AP_ALT_VAR_SET_METRIC` | meters, index | Set altitude in meters |
| `AP_ALT_VAR_INC` / `_DEC` | new alt, index | Inc/dec altitude |
| `ALTITUDE_SLOT_INDEX_SET` | index | Set altitude slot index |

### Vertical Speed
| Event | Param | Notes |
|-------|-------|-------|
| `AP_VS_HOLD` / `_ON` / `_OFF` | — | Vertical speed hold |
| `AP_VS_VAR_SET_ENGLISH` | ft/min, index | Set VS in ft/min |
| `AP_VS_VAR_SET_METRIC` | m/min, index | Set VS in m/min |
| `AP_VS_VAR_INC` / `_DEC` | — | Inc/dec vertical speed |
| `AP_VS_VAR_SET_CURRENT` | — | Set VS to current |
| `VS_SLOT_INDEX_SET` | index | Set VS slot index |

### Airspeed / Mach
| Event | Param | Notes |
|-------|-------|-------|
| `AP_AIRSPEED_HOLD` / `_ON` / `_OFF` | — | Airspeed hold |
| `AP_SPD_VAR_SET` | knots, index | Set airspeed |
| `AP_SPD_VAR_SET_EX1` | speed/100, index | Precise airspeed |
| `AP_SPD_VAR_INC` / `_DEC` | — | Inc/dec airspeed |
| `AP_MACH_HOLD` / `_ON` / `_OFF` | — | Mach hold |
| `AP_MACH_VAR_SET` | mach/100, engine | Set mach reference |
| `AP_MACH_VAR_SET_EX1` | mach/1000000, engine | Precise mach |
| `SPEED_SLOT_INDEX_SET` | index | Set speed slot index |

### Flight Level Change
| Event | Param | Notes |
|-------|-------|-------|
| `FLIGHT_LEVEL_CHANGE` / `_ON` / `_OFF` | — | FLC mode |

### Navigation Modes
| Event | Param | Notes |
|-------|-------|-------|
| `AP_NAV1_HOLD` / `_ON` / `_OFF` | — | NAV hold mode |
| `AP_NAV_SELECT_SET` | 1 or 2 | Select NAV source |
| `AP_LOC_HOLD` / `_ON` / `_OFF` | — | Localizer hold |
| `AP_APR_HOLD` / `_ON` / `_OFF` | — | Approach hold (LOC+GS) |
| `AP_BC_HOLD` / `_ON` / `_OFF` | — | Backcourse mode |

### Attitude / Wing Leveler
| Event | Param | Notes |
|-------|-------|-------|
| `AP_ATT_HOLD` / `_ON` / `_OFF` | — | Attitude hold |
| `AP_WING_LEVELER` / `_ON` / `_OFF` | — | Wing leveler |
| `AP_PITCH_LEVELER` / `_ON` / `_OFF` | — | Pitch leveler |

### Bank Control
| Event | Param | Notes |
|-------|-------|-------|
| `AP_BANK_HOLD` / `_ON` / `_OFF` | — | Bank hold |
| `AP_MAX_BANK_SET` | index | Set max bank angle index |
| `AP_MAX_BANK_INC` / `_DEC` | — | Inc/dec max bank |

### Advanced
| Event | Param | Notes |
|-------|-------|-------|
| `AP_N1_HOLD` | — | Hold N1 at current level |
| `AP_N1_REF_SET` | N1, engine | Set N1 reference |
| `AP_PITCH_REF_SET` | -16384 to 16384 | Set pitch reference |
| `AP_MANAGED_SPEED_IN_MACH_TOGGLE` | — | Toggle managed mach |
| `AP_AVIONICS_MANAGED_TOGGLE` | — | Toggle avionics managed |

---

## 2. Radios

### COM Radio (COM1/COM2/COM3)
| Event | Param | Notes |
|-------|-------|-------|
| `COM_RADIO_SET_HZ` / `COM2_RADIO_SET_HZ` / `COM3_RADIO_SET_HZ` | freq Hz | e.g. 126700000 for 126.7 MHz |
| `COM_STBY_RADIO_SET_HZ` / `COM2_STBY_RADIO_SET_HZ` | freq Hz | Standby frequency |
| `COM_RADIO_SWAP` / `COM2_RADIO_SWAP` | — | Swap active/standby |
| `COM_RADIO_WHOLE_INC` / `_DEC` | — | Inc/dec MHz (118-137) |
| `COM_RADIO_FRACT_INC` / `_DEC` | — | Inc/dec 25 KHz |
| `COM_RADIO_FRACT_INC_CARRY` / `_DEC_CARRY` | — | With carry |
| `COM1_VOLUME_SET` / `COM2_VOLUME_SET` | 0-1 | Volume |
| `COM1_TRANSMIT_SELECT` / `COM2_TRANSMIT_SELECT` | — | Select transmit |
| `COM_RECEIVE_ALL_SET` | bool | All COM receive |

### NAV Radio (NAV1/NAV2)
| Event | Param | Notes |
|-------|-------|-------|
| `NAV1_RADIO_SET_HZ` / `NAV2_RADIO_SET_HZ` | freq Hz | NAV frequency |
| `NAV1_STBY_SET_HZ` / `NAV2_STBY_SET_HZ` | freq Hz | NAV standby |
| `NAV1_RADIO_SWAP` / `NAV2_RADIO_SWAP` | — | Swap active/standby |
| `NAV1_RADIO_WHOLE_INC` / `_DEC` | — | Inc/dec MHz |
| `NAV1_RADIO_FRACT_INC` / `_DEC` | — | Inc/dec 25 KHz |
| `NAV1_VOLUME_SET` / `NAV2_VOLUME_SET` | 0-1 | Volume |

### VOR OBS
| Event | Param | Notes |
|-------|-------|-------|
| `VOR1_SET` / `VOR2_SET` | degrees 0-360 | Set VOR OBS |
| `VOR1_OBI_INC` / `_DEC` | — | Inc/dec by 1 degree |
| `VOR1_OBI_FAST_INC` / `_FAST_DEC` | — | Inc/dec by 10 degrees |
| `RADIO_VOR1_IDENT_TOGGLE` | — | VOR ID audio |

### ADF Radio
| Event | Param | Notes |
|-------|-------|-------|
| `ADF_COMPLETE_SET` / `ADF2_COMPLETE_SET` | freq BCD32 Hz | ADF frequency |
| `ADF1_RADIO_SWAP` / `ADF2_RADIO_SWAP` | — | Swap active/standby |
| `ADF_100_INC` / `_DEC` | — | Inc/dec 100 KHz |
| `ADF_10_INC` / `_DEC` | — | Inc/dec 10 KHz |
| `ADF_1_INC` / `_DEC` | — | Inc/dec 1 KHz |
| `ADF_CARD_SET` | 0-360 | Set ADF card |
| `ADF_VOLUME_SET` | 0-100 | Volume |

### Transponder
| Event | Param | Notes |
|-------|-------|-------|
| `XPNDR_SET` | BCD16 code | Set transponder code |
| `XPNDR_1000_INC` / `_DEC` | — | First digit |
| `XPNDR_100_INC` / `_DEC` | — | Second digit |
| `XPNDR_10_INC` / `_DEC` | — | Third digit |
| `XPNDR_1_INC` / `_DEC` | — | Fourth digit |
| `XPNDR_IDENT_TOGGLE` / `_ON` / `_OFF` | — | Ident (18s auto-off) |

### DME
| Event | Param | Notes |
|-------|-------|-------|
| `DME_SELECT` | 1 or 2 | Select DME |
| `TOGGLE_DME` | — | Toggle between NAV1/NAV2 |
| `RADIO_DME1_IDENT_TOGGLE` | — | DME ID audio |

### GPS Navigation
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_GPS_DRIVES_NAV1` | — | Toggle GPS/NAV1 CDI source |
| `GPS_OBS_SET` | degrees | Set GPS OBS |
| `GPS_OBS_INC` / `_DEC` | — | Inc/dec by 1 degree |
| `GPS_OBS_TOGGLE` / `_ON` / `_OFF` | — | GPS OBS mode |

---

## 3. Flight Controls

### Flaps
| Event | Param | Notes |
|-------|-------|-------|
| `FLAPS_SET` | 0-16383 | Set to closest increment |
| `AXIS_FLAPS_SET` | -16383 to 16383 | Axis-based |
| `FLAPS_UP` / `FLAPS_DOWN` | — | Full retract/extend |
| `FLAPS_INCR` / `FLAPS_DECR` | — | One notch |
| `FLAPS_1` / `_2` / `_3` / `_4` | — | Preset positions |

### Landing Gear
| Event | Param | Notes |
|-------|-------|-------|
| `GEAR_TOGGLE` | — | Toggle gear |
| `GEAR_UP` / `GEAR_DOWN` | — | Explicit control |
| `GEAR_SET` | 0=up, 1=down | Set position |
| `GEAR_EMERGENCY_HANDLE_TOGGLE` | — | Emergency extension |

### Spoilers
| Event | Param | Notes |
|-------|-------|-------|
| `SPOILERS_SET` | 0-16383 | Set handle position |
| `SPOILERS_ON` / `_OFF` | — | Full extend/retract |
| `SPOILERS_TOGGLE` | — | Toggle handle |
| `SPOILERS_ARM_TOGGLE` / `_SET` | bool | Auto-spoiler arming |

### Elevator Trim
| Event | Param | Notes |
|-------|-------|-------|
| `ELEVATOR_TRIM_SET` | -16383 to 16384 | Set trim |
| `AXIS_ELEV_TRIM_SET` | -16383 to 16384 | Axis trim |
| `ELEV_TRIM_UP` / `_DN` | — | Inc/dec by 0.0005 |

### Aileron Trim
| Event | Param | Notes |
|-------|-------|-------|
| `AILERON_TRIM_SET` | -100 to 100 | Set aileron trim |
| `AILERON_TRIM_SET_EX1` | -16383 to 16384 | Precise trim |
| `AILERON_TRIM_LEFT` / `_RIGHT` | — | Inc by 0.001 |

### Rudder Trim
| Event | Param | Notes |
|-------|-------|-------|
| `RUDDER_TRIM_SET` | -100 to 100 | Set rudder trim |
| `RUDDER_TRIM_SET_EX1` | -16383 to 16383 | Precise trim |
| `RUDDER_TRIM_LEFT` / `_RIGHT` | — | Inc trim |
| `RUDDER_TRIM_RESET` | — | Reset to center |

### Direct Surfaces
| Event | Param | Notes |
|-------|-------|-------|
| `AILERON_SET` / `AXIS_AILERONS_SET` | -16383 to 16384 | Aileron position |
| `ELEVATOR_SET` / `AXIS_ELEVATOR_SET` | -16383 to 16384 | Elevator position |
| `RUDDER_SET` / `AXIS_RUDDER_SET` | -16383 to 16383 | Rudder position |
| `CENTER_AILER_RUDDER` | — | Center aileron and rudder |

---

## 4. Engine

### Throttle
| Event | Param | Notes |
|-------|-------|-------|
| `THROTTLE_SET` / `THROTTLE1_SET` / `THROTTLE2_SET` | 0-16383 | Set throttle |
| `AXIS_THROTTLE_SET` / `AXIS_THROTTLE1_SET` | 0-16383 | Axis-based |
| `THROTTLE_FULL` / `THROTTLE1_FULL` | — | Max throttle |
| `THROTTLE_CUT` / `THROTTLE1_CUT` | — | Idle |
| `THROTTLE_INCR` / `_DECR` | — | Inc/dec 10% |
| `THROTTLE_INCR_SMALL` / `_DECR_SMALL` | — | Small increment |
| `THROTTLE_REVERSE_THRUST_TOGGLE` | — | Reverse thrust |
| `SET_REVERSE_THRUST_ON` / `_OFF` | — | All engines |

### Mixture
| Event | Param | Notes |
|-------|-------|-------|
| `MIXTURE_SET` / `MIXTURE1_SET` | 0-16383 | Set mixture |
| `AXIS_MIXTURE_SET` / `AXIS_MIXTURE1_SET` | — | Axis-based |
| `MIXTURE_RICH` / `MIXTURE_LEAN` | — | Full rich/lean |
| `MIXTURE_INCR` / `_DECR` | — | Inc/dec |
| `MIXTURE_SET_BEST` | — | Optimal mixture |

### Propeller
| Event | Param | Notes |
|-------|-------|-------|
| `PROP_PITCH_SET` / `PROP_PITCH1_SET` | 0-16383 | Set prop RPM |
| `PROP_PITCH_HI` / `_LO` | — | Max/min pitch |
| `PROP_PITCH_INCR` / `_DECR` | — | Inc/dec |
| `TOGGLE_FEATHER_SWITCHES` | — | Feathering |
| `TOGGLE_PROPELLER_SYNC` | — | Prop sync |
| `TOGGLE_PROPELLER_DEICE` | — | Prop deice |

### Magnetos & Starter
| Event | Param | Notes |
|-------|-------|-------|
| `MAGNETO_OFF` / `_LEFT` / `_RIGHT` / `_BOTH` | — | Switch positions |
| `MAGNETO_START` | — | Magnetos on + starter |
| `TOGGLE_STARTER1` / `TOGGLE_ALL_STARTERS` | — | Starter motor |
| `ENGINE_AUTO_START` / `_SHUTDOWN` | — | Automated engine |
| `TOGGLE_MASTER_IGNITION_SWITCH` | — | Master ignition |

### Fuel
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_ELECT_FUEL_PUMP` / `TOGGLE_ELECT_FUEL_PUMP1` | — | Fuel pump |
| `TOGGLE_FUEL_VALVE_ALL` / `_ENG1` | — | Fuel valve |
| `SHUTOFF_VALVE_TOGGLE` / `_ON` / `_OFF` | — | Shutoff valve |

### Cowl Flaps / Condition Lever
| Event | Param | Notes |
|-------|-------|-------|
| `INC_COWL_FLAPS` / `DEC_COWL_FLAPS` | — | All engines |
| `COWLFLAP1_SET` | 0-16383 | Direct position |
| `CONDITION_LEVER_1_SET` | 0-2 | Turboprop condition |

### Anti-Ice (Engine)
| Event | Param | Notes |
|-------|-------|-------|
| `ANTI_ICE_TOGGLE` / `_ON` / `_OFF` | — | All engines |
| `ANTI_ICE_TOGGLE_ENG1` / `_SET_ENG1` | bool | Engine-specific |

---

## 5. Electrical

### Battery & Alternator
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_MASTER_BATTERY` | battery idx | Toggle battery |
| `MASTER_BATTERY_ON` / `_OFF` | battery idx | Explicit |
| `MASTER_BATTERY_SET` | idx, bool | Set state |
| `TOGGLE_ALTERNATOR1` / `2` | — | Toggle alternator |
| `TOGGLE_MASTER_ALTERNATOR` | alt idx | Toggle by index |
| `ALTERNATOR_SET` | bool, alt idx | Set state |

### Avionics & Power
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_AVIONICS_MASTER` | — | Avionics master |
| `AVIONICS_MASTER_SET` | bool | Set state |
| `TOGGLE_EXTERNAL_POWER` | idx | Ground power unit |
| `SET_EXTERNAL_POWER` | idx, state | Set GPU state |
| `TOGGLE_ELECTRIC_VACUUM_PUMP` | — | Backup vacuum |

### APU
| Event | Param | Notes |
|-------|-------|-------|
| `APU_STARTER` | — | Start APU |
| `APU_OFF_SWITCH` | — | Turn APU off |
| `APU_GENERATOR_SWITCH_TOGGLE` | — | APU generator |
| `APU_BLEED_AIR_SOURCE_TOGGLE` | — | APU bleed air |

### Circuit Breakers
| Event | Param | Notes |
|-------|-------|-------|
| `BREAKER_AUTOPILOT_TOGGLE` / `_SET` | — | AP breaker |
| `BREAKER_AVNBUS1_TOGGLE` / `_SET` | — | Avionics bus 1 |
| `BREAKER_AVNBUS2_TOGGLE` / `_SET` | — | Avionics bus 2 |
| `BREAKER_NAVCOM1_TOGGLE` / `_SET` | — | NAV/COM 1 |
| `BREAKER_GPS_TOGGLE` / `_SET` | — | GPS |
| `BREAKER_FLAP_TOGGLE` / `_SET` | — | Flaps |
| `BREAKER_XPNDR_TOGGLE` / `_SET` | — | Transponder |
| `ELECTRICAL_CIRCUIT_TOGGLE` | circuit idx | Generic circuit |

---

## 6. Lights

### Exterior
| Event | Param | Notes |
|-------|-------|-------|
| `LANDING_LIGHTS_TOGGLE` / `_ON` / `_OFF` | circuit | Landing lights |
| `LANDING_LIGHTS_SET` | state, light idx | Set state |
| `TAXI_LIGHTS_TOGGLE` / `_ON` / `_OFF` | circuit | Taxi lights |
| `STROBES_TOGGLE` / `_ON` / `_OFF` | circuit | Strobe lights |
| `TOGGLE_BEACON_LIGHTS` / `BEACON_LIGHTS_ON` / `_OFF` | circuit | Beacon |
| `TOGGLE_NAV_LIGHTS` / `NAV_LIGHTS_ON` / `_OFF` | circuit | Navigation |
| `TOGGLE_LOGO_LIGHTS` | — | Logo lights |
| `TOGGLE_RECOGNITION_LIGHTS` | — | Recognition |
| `TOGGLE_WING_LIGHTS` / `WING_LIGHTS_ON` / `_OFF` | circuit | Wing |

### Interior
| Event | Param | Notes |
|-------|-------|-------|
| `PANEL_LIGHTS_TOGGLE` / `_ON` / `_OFF` | circuit | Panel |
| `TOGGLE_CABIN_LIGHTS` / `CABIN_LIGHTS_ON` / `_OFF` | circuit | Cabin |
| `GLARESHIELD_LIGHTS_TOGGLE` / `_ON` / `_OFF` | circuit | Glareshield |
| `PEDESTRAL_LIGHTS_TOGGLE` / `_ON` / `_OFF` | circuit | Pedestal |

### Brightness (Potentiometers)
| Event | Param | Notes |
|-------|-------|-------|
| `LIGHT_POTENTIOMETER_SET` | index, value | Set brightness |
| `LIGHT_POTENTIOMETER_1_SET` ... `_30_SET` | value | Specific pot |
| `ALL_LIGHTS_TOGGLE` | circuit idx | Toggle all lights |

### Landing Light Rotation
| Event | Param | Notes |
|-------|-------|-------|
| `LANDING_LIGHT_UP` / `_DOWN` / `_LEFT` / `_RIGHT` | circuit | Rotate |
| `LANDING_LIGHT_HOME` | circuit | Return to default |

---

## 7. Aircraft Systems

### Ice Protection
| Event | Param | Notes |
|-------|-------|-------|
| `PITOT_HEAT_TOGGLE` / `_ON` / `_OFF` | — | Pitot heat |
| `PITOT_HEAT_SET` | bool | Set state |
| `TOGGLE_STRUCTURAL_DEICE` | — | Airframe deicing |
| `WINDSHIELD_DEICE_TOGGLE` / `_ON` / `_OFF` | — | Windshield |

### Brakes
| Event | Param | Notes |
|-------|-------|-------|
| `PARKING_BRAKES` | — | Increment parking brake |
| `PARKING_BRAKE_SET` | bool | Set parking brake |
| `BRAKES` / `BRAKES_LEFT` / `_RIGHT` | — | Increment pressure |
| `AXIS_LEFT_BRAKE_SET` / `AXIS_RIGHT_BRAKE_SET` | -16383 to 16383 | Axis brakes |
| `ANTISKID_BRAKES_TOGGLE` | — | Anti-skid |

### Pressurization
| Event | Param | Notes |
|-------|-------|-------|
| `PRESSURIZATION_PRESSURE_ALT_INC` / `_DEC` | — | ~50 ft increments |
| `PRESSURIZATION_CLIMB_RATE_INC` / `_DEC` | — | ~50 ft/min |
| `PRESSURIZATION_CLIMB_RATE_SET` | rate | Set climb rate |
| `PRESSURIZATION_PRESSURE_DUMP_SWITCH` | — | Pressure dump |

### Doors & Ground Services
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_AIRCRAFT_EXIT` | — | Toggle exit door |
| `TOGGLE_JETWAY` | — | Request/dismiss jetway |
| `TOGGLE_RAMPTRUCK` | — | Boarding ramp |
| `TOGGLE_PUSHBACK` | — | Pushback |
| `REQUEST_CATERING` | — | Catering truck |
| `REQUEST_LUGGAGE` | — | Baggage loader |
| `REQUEST_POWER_SUPPLY` | — | Ground power unit |

### Cabin Signs
| Event | Param | Notes |
|-------|-------|-------|
| `CABIN_SEATBELTS_ALERT_SWITCH_TOGGLE` | — | Seatbelt sign |
| `CABIN_NO_SMOKING_ALERT_SWITCH_TOGGLE` | — | No smoking sign |

### Warnings
| Event | Param | Notes |
|-------|-------|-------|
| `MASTER_CAUTION_ACKNOWLEDGE` / `_TOGGLE` | — | Master caution |
| `MASTER_WARNING_ACKNOWLEDGE` / `_TOGGLE` | — | Master warning |
| `HORN_TRIGGER` | — | Aircraft horn |

### Carrier Operations
| Event | Param | Notes |
|-------|-------|-------|
| `TOGGLE_TAIL_HOOK_HANDLE` | — | Tail hook |
| `TOGGLE_WING_FOLD` | — | Wing fold |
| `TAKEOFF_ASSIST_ARM_TOGGLE` / `_SET` | bool | Catapult arm |
| `TAKEOFF_ASSIST_FIRE` | — | Catapult launch |
| `TOGGLE_LAUNCH_BAR_SWITCH` | — | Launch bar |

### Failures (Testing)
| Event | Notes |
|-------|-------|
| `TOGGLE_ELECTRICAL_FAILURE` | Electrical system |
| `TOGGLE_ENGINE1_FAILURE` / `_ENGINE2_FAILURE` | Engine failure |
| `TOGGLE_HYDRAULIC_FAILURE` | Hydraulic system |
| `TOGGLE_VACUUM_FAILURE` | Vacuum system |
| `TOGGLE_LEFT_BRAKE_FAILURE` / `_RIGHT_BRAKE_FAILURE` | Brake failure |
| `TOGGLE_TOTAL_BRAKE_FAILURE` | Both brakes |
| `TOGGLE_PITOT_BLOCKAGE` | Blocked pitot tube |
| `TOGGLE_STATIC_PORT_BLOCKAGE` | Blocked static port |

### Miscellaneous
| Event | Param | Notes |
|-------|-------|-------|
| `SMOKE_TOGGLE` / `_ON` / `_OFF` | — | Smoke system |
| `TOGGLE_ALTERNATE_STATIC` | — | Alternate static port |
| `HYDRAULIC_SWITCH_TOGGLE` | — | Hydraulic switch |
| `BLEED_AIR_SOURCE_CONTROL_SET` | source | Bleed air source |
| `ENGINE_BLEED_AIR_SOURCE_TOGGLE` | engine 0-4 | Engine bleed air |

---

## 8. Simulation

### Pause
| Event | Param | Notes |
|-------|-------|-------|
| `PAUSE_TOGGLE` / `_ON` / `_OFF` | — | **Unreliable in MSFS** |
| `PAUSE_SET` | bool | Set pause state |

### Sim Rate
| Event | Param | Notes |
|-------|-------|-------|
| `SIM_RATE_INCR` / `_DECR` | — | Inc/dec sim rate |

### Slew Mode
| Event | Param | Notes |
|-------|-------|-------|
| `SLEW_TOGGLE` / `_ON` / `_OFF` | — | Toggle slew |
| `SLEW_SET` | bool | Set slew state |
| `SLEW_RESET` | — | Reset pitch/bank/heading |
| `SLEW_AHEAD_PLUS` / `_MINUS` | — | Forward slew |
| `SLEW_LEFT` / `_RIGHT` | — | Sideways |
| `SLEW_ALTIT_UP_FAST` / `_DN_FAST` | — | Vertical fast |
| `SLEW_ALTIT_UP_SLOW` / `_DN_SLOW` | — | Vertical slow |
| `AXIS_SLEW_AHEAD_SET` / `_SIDEWAYS_SET` / `_ALT_SET` | +/- 16383 | Axis slew |

### Freeze
| Event | Param | Notes |
|-------|-------|-------|
| `FREEZE_LATITUDE_LONGITUDE_TOGGLE` / `_SET` | — | Freeze position |
| `FREEZE_ALTITUDE_TOGGLE` / `_SET` | — | Freeze altitude |
| `FREEZE_ATTITUDE_TOGGLE` / `_SET` | — | Freeze pitch/bank/heading |

### Time/Date
| Event | Param | Notes |
|-------|-------|-------|
| `CLOCK_HOURS_SET` / `_INC` / `_DEC` | — | Sim clock hours |
| `CLOCK_MINUTES_SET` / `_INC` / `_DEC` | — | Sim clock minutes |
| `ZULU_DAY_SET` / `ZULU_HOURS_SET` / `ZULU_MINUTES_SET` / `ZULU_YEAR_SET` | — | Zulu time |

### Miscellaneous
| Event | Param | Notes |
|-------|-------|-------|
| `SIM_RESET` | — | Reset aircraft state |
| `RELOAD_USER_AIRCRAFT` | — | Reload aircraft data |
| `CAPTURE_SCREENSHOT` | — | Save screenshot as BMP |

---

## 9. GPS

| Event | Param | Notes |
|-------|-------|-------|
| `GPS_DIRECTTO_BUTTON` | — | Direct To page |
| `GPS_FLIGHTPLAN_BUTTON` | — | Flight plan display |
| `GPS_NEAREST_BUTTON` | — | Nearest airport |
| `GPS_PROCEDURE_BUTTON` | — | Approach procedures |
| `GPS_ACTIVATE_BUTTON` / `GPS_ENTER_BUTTON` | — | Activate/enter |
| `GPS_CURSOR_BUTTON` / `GPS_CLEAR_BUTTON` | — | Cursor/clear |
| `GPS_GROUP_KNOB_INC` / `_DEC` | — | Group knob |
| `GPS_PAGE_KNOB_INC` / `_DEC` | — | Page knob |
| `GPS_ZOOMIN_BUTTON` / `_ZOOMOUT_BUTTON` | — | Zoom |
| `GPS_TERRAIN_BUTTON` | — | Terrain display |
| `GPS_VNAV_BUTTON` | — | Vertical navigation |
| `GPS_POWER_BUTTON` | — | Toggle GPS power |
| `GPS_MSG_BUTTON` | — | Message page |
| `GPS_SETUP_BUTTON` | — | GPS setup |

---

## 10. Camera

**Camera events are BROKEN in MSFS.** They return S_OK but have no effect. Use keyboard simulation (SendKeys/AHK) instead.

Our `camera-controller.js` already handles this via TCP KeySenderService / FastKeySender / PowerShell fallback.

---

## 11. ATC

| Event | Notes |
|-------|-------|
| `ATC_MENU_1` through `ATC_MENU_0` | Select ATC menu items |
| `SIMUI_WINDOW_HIDESHOW` | Display ATC window |

Limited control — most ATC interaction requires UI.

---

## InputEvents (B: Variables) vs Legacy Key Events

### Legacy Key Events (K: variables)
- All events listed above
- Use `mapClientEventToSimEvent` + `transmitClientEvent`
- Backward compatible with FSX/P3D/MSFS 2020/2024
- Work for default and most GA aircraft

### InputEvents (B: variables) — MSFS 2020/2024
- Aircraft-specific modern control system
- **Cannot** be sent via `transmitClientEvent`
- Require special workflow:
  1. `enumerateInputEvents` — get all events for loaded aircraft
  2. Get hash for desired event
  3. `setInputEvent(hash, value)` — send the event
- Required for study-level aircraft (PMDG, Fenix, etc.)
- Our server already enumerates these via dedicated SimConnect connection

### Which to Use?
- **Default/GA aircraft:** Legacy Key Events work fine
- **Study-level airliners:** May require InputEvents
- **Best practice:** Try legacy events first, fall back to InputEvents

---

## Sources

- [MSFS 2024 Key Events](https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/Key_Events/Key_Events.htm)
- [MSFS SDK Event IDs](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Event_IDs.htm)
- [Aircraft Autopilot Events](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Autopilot_Flight_Assist_Events.htm)
- [Aircraft Radio Events](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Radio_Navigation_Events.htm)
- [Aircraft Electrical Events](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Electrical_Events.htm)
- [Aircraft Flight Control Events](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Flight_Control_Events.htm)
- [Aircraft Engine Events](https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Engine_Events.htm)
