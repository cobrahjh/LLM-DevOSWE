# MSFS 2024 Weather Preset File Format (.WPR)

## Phase 2 Research - Complete XML Schema

**Status**: ✅ Format documented and compatible with MSFS 2024
**File Extension**: `.wpr` (XML format)
**Official Docs**: [Weather XML Properties](https://docs.flightsimulator.com/msfs2024/html/5_Content_Configuration/Mission_XML_Files/Weather_XML_Properties.htm)

## File Locations

### System Weather Presets (User-Created)
```
C:\Users\[Username]\AppData\Roaming\Microsoft Flight Simulator 2024\Weather\Presets\
```

### Mission Weather Files
```
[MissionFolder]\Weather.wpr
```

### Community Add-ons (NOT for weather presets)
```
C:\Users\[Username]\AppData\Local\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community\
```

**Important**: Weather presets go in `Weather\Presets`, NOT in Community folder.

---

## Complete XML Schema

### Root Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="WeatherPreset" version="1,3">
    <Descr>AceXML Document</Descr>
    <WeatherPreset.Preset>
        <!-- Weather elements here -->
    </WeatherPreset.Preset>
</SimBase.Document>
```

---

## Main Elements (WeatherPreset.Preset Children)

### Metadata & Display
| Element | Type | Description | Example |
|---------|------|-------------|---------|
| `<Name>` | String | Preset display name | `Clear Skies VFR` |
| `<Order>` | Integer | Menu position (9+ for custom) | `10` |
| `<Image>` | String | Background JPG (332×105px) | `.\Image.jpg` |
| `<LayeredImage>` | String | Foreground PNG (694×248px) | `.\LayeredImage.png` |
| `<Icon>` | String | SVG icon (~150×150px) | `.\Icon.svg` |
| `<LoadingTip>` | String | Loading screen tip | `Perfect VFR conditions` |
| `<LiveID>` | Enum | Link to default preset | `WEATHER_CLEAR_SKY` |

### Atmospheric Conditions
| Element | Type | Range | Units | Description |
|---------|------|-------|-------|-------------|
| `<IsAltitudeAMGL>` | Boolean | True/False | - | True=AGL, False=MSL |
| `<MSLPressure>` | Float | 50000-130000 | Pa | Sea level pressure |
| `<MSLTemperature>` | Float | 200-330 | Kelvin | Sea level temp |
| `<AerosolDensity>` | Float | 0.0-1.0 | (0-1) | Haze/particle density |
| `<Precipitations>` | Float | 0-100 | mm/h | Rainfall rate |
| `<PrecipitationType>` | Enum | RAIN/SNOW/HAIL | - | Type of precip |
| `<SnowCover>` | Float | 0-4 | meters | Ground snow depth |
| `<ThunderstormIntensity>` | Float | 0-1 | (0-1) | Storm intensity |

### LiveID Valid Values
```
WEATHER_UNKNOWN
WEATHER_CLEAR_SKY
WEATHER_FEW_CLOUDS
WEATHER_BROKEN_CLOUDS
WEATHER_SCATTERED
WEATHER_OVERCAST
WEATHER_HIGH_CLOUDS
WEATHER_RAIN
WEATHER_STORM
```

---

## CloudLayer (Multiple Allowed)

```xml
<CloudLayer>
    <CloudLayerAltitudeBot value="2000" unit="m"/>
    <CloudLayerAltitudeTop value="3000" unit="m"/>
    <CloudLayerDensity value="0.6" unit="(0 - 1)"/>
    <CloudLayerScattering value="0.8" unit="(0 - 1)"/>
</CloudLayer>
```

### CloudLayer Attributes
| Attribute | Range | Units | Description |
|-----------|-------|-------|-------------|
| `AltitudeBot` | 0-18000 | m | Layer bottom (MSL or AGL) |
| `AltitudeTop` | 0-18000 | m | Layer top (MSL or AGL) |
| `Density` | 0.0-1.0 | (0-1) | Cloud coverage (0=clear, 1=solid) |
| `Scattering` | 0.0-1.0 | (0-1) | Light scattering (opacity) |

---

## WindLayer (Multiple Allowed)

```xml
<WindLayer>
    <WindLayerAltitude value="0" unit="m"/>
    <WindLayerAngle value="270" unit="degrees"/>
    <WindLayerSpeed value="15" unit="knts"/>
    <GustWave>
        <GustWaveDuration value="5" unit="sec"/>
        <GustWaveInterval value="15" unit="sec"/>
        <GustWaveSpeed value="10" unit="knts"/>
        <GustAngle value="290" unit="degrees"/>
    </GustWave>
</WindLayer>
```

### WindLayer Attributes
| Attribute | Range | Units | Description |
|-----------|-------|-------|-------------|
| `Altitude` | 0-18000 | m | Wind layer altitude |
| `Angle` | 0-360 | degrees | Wind direction (0=North) |
| `Speed` | 0-200 | knts | Wind speed |

### GustWave (Optional)
| Attribute | Range | Units | Description |
|-----------|-------|-------|-------------|
| `Duration` | 1-60 | sec | Gust duration |
| `Interval` | 5-300 | sec | Time between gusts |
| `Speed` | 0-100 | knts | Gust speed increase |
| `Angle` | 0-360 | degrees | Gust direction |

---

## ThunderstormCell & Hurricane (Experimental)

```xml
<ThunderstormCell>
    <Cell>
        <Latitude>47.45</Latitude>
        <Longitude>-122.31</Longitude>
        <Radius value="5000" unit="m"/>
    </Cell>
    <SuperCell>
        <Latitude>47.50</Latitude>
        <Longitude>-122.40</Longitude>
        <Radius value="15000" unit="m"/>
    </SuperCell>
</ThunderstormCell>
```

---

## Unit Conversions

### Pressure
- **Standard**: 29.92 inHg = 101325 Pa = 1013.25 mb
- **Formula**: inHg × 3386.39 = Pa

### Temperature
- **Formula**: (°C + 273.15) = Kelvin
- **Standard**: 15°C = 288.15 K

### Common Values
| Condition | MSLPressure (Pa) | MSLTemperature (K) |
|-----------|------------------|---------------------|
| Standard Day | 101325 | 288.15 (15°C) |
| High Pressure | 103000 | 288 |
| Low Pressure | 98000 | 285 |
| Hot Day | 101325 | 308 (35°C) |
| Cold Day | 101325 | 268 (-5°C) |

---

## Critical Requirements

1. ✅ **File name**: Must be exactly `Weather.wpr` (for missions)
2. ✅ **Encoding**: UTF-8
3. ✅ **XML version**: 1.0
4. ✅ **Document type**: `WeatherPreset` version `1,3`
5. ✅ **Units required**: ALL numeric values need explicit `unit` attribute
6. ✅ **Ranges**: Stay within documented min/max values
7. ✅ **Order**: Custom presets should use Order ≥ 9

---

## SimGlass Integration Capability

**Can we create .WPR files programmatically?** ✅ **YES**

We can:
1. ✅ Read current weather via SimConnect (Phase 1 complete)
2. ✅ Generate valid XML matching MSFS schema (documented above)
3. ✅ Write .WPR files to user's weather preset folder
4. ✅ User applies preset via MSFS weather menu

**Limitation**: Cannot *apply* presets programmatically (no SimConnect API), but CAN save current conditions as reusable presets.

---

## Sources

- [Weather XML Properties - MSFS 2024 SDK](https://docs.flightsimulator.com/msfs2024/html/5_Content_Configuration/Mission_XML_Files/Weather_XML_Properties.htm)
- [Weather Definitions - FSDeveloper Wiki](https://www.fsdeveloper.com/wiki/index.php/Weather_definitions_(MSFS))
- [MSFS DevSupport - .WPR Files Discussion](https://devsupport.flightsimulator.com/t/questions-about-custom-weather-presets-wpr-files/17057)
- [Custom Saved Weather Presets Storage](https://forums.flightsimulator.com/t/where-are-custom-saved-weather-presets-stored/284779)
