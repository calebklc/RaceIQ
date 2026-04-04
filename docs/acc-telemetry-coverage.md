# Assetto Corsa Competizione Telemetry Coverage

What RaceIQ captures from ACC's shared memory interface.

## Data Source

Three Windows shared memory mapped files, read via kernel32 FFI:
- `acpmf_physics` — vehicle physics (~300 Hz)
- `acpmf_graphics` — session/race state (~60 Hz)
- `acpmf_static` — car/track metadata (once per session)

Requires RaceIQ to run on the same machine as ACC (shared memory is local only).

## Captured Per Packet (60 Hz)

### Motion & Orientation (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Velocity X/Y/Z | `VelocityX/Y/Z` | m/s |
| G-force lateral/longitudinal/vertical | `AccelerationX/Y/Z` | m/s² |
| Heading | `Yaw` | Radians |
| Pitch | `Pitch` | Radians |
| Roll | `Roll` | Radians |
| Position X/Y/Z | `PositionX/Y/Z` (from Graphics) | Meters |
| Speed | `Speed` | m/s |

### Engine (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| RPM | `CurrentEngineRpm` | RPM |
| Max RPM | `EngineMaxRpm` | RPM |

### Suspension (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Suspension travel (4 wheels) | `NormSuspensionTravelXX`, `SuspensionTravelMetersXX` | Meters |

### Tires (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Wheel slip (4 wheels) | `TireSlipRatioXX`, `TireSlipAngleXX`, `TireCombinedSlipXX` | Magnitude |
| Wheel angular speed (4 wheels) | `WheelRotationSpeedXX` | rad/s |
| Tyre wear (4 wheels) | `TireWearXX` | 0–1 |
| Tyre pressure (4 wheels) | `acc.tirePressure[]` | PSI |
| Tyre surface temp (4 wheels) | `TireTempXX` | °C |
| Tyre core temp (4 wheels) | `acc.tireCoreTemp[]` | °C |
| Tyre inner surface temp (4 wheels) | `acc.tireInnerTemp[]` | °C |
| Tyre outer surface temp (4 wheels) | `acc.tireOuterTemp[]` | °C |

### Brakes (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Brake temp (4 wheels) | `acc.brakeTemp[]` | °C |
| Brake pad wear (4 wheels) | `acc.brakePadWear[]` | mm remaining |

### Driver Inputs (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Throttle | `Accel` | 0–255 |
| Brake | `Brake` | 0–255 |
| Steering | `Steer` | -127 to 127 |
| Gear | `Gear` | 0=R, 1=N, 2+=gears |
| Fuel | `Fuel` | Liters |

### Damage (Physics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Car damage (front/rear/left/right/centre) | `acc.carDamage` | 0–1 |

### Electronics (Graphics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Traction control | `acc.tc` | Level |
| TC cut | `acc.tcCut` | Level |
| ABS | `acc.abs` | Level |
| Engine map | `acc.engineMap` | Mode |
| Brake bias | `acc.brakeBias` | % |

### Session & Race (Graphics)
| Field | Stored As | Units |
|-------|-----------|-------|
| Current lap time | `CurrentLap` | Seconds |
| Last lap time | `LastLap` | Seconds |
| Best lap time | `BestLap` | Seconds |
| Lap number | `LapNumber` | Count |
| Race position | `RacePosition` | Position |
| Distance traveled | `DistanceTraveled` | Meters |
| Pit status | `acc.pitStatus` | "in_pit", "pit_lane", "out" |
| Flag status | `acc.flagStatus` | Enum |
| Fuel per lap | `acc.fuelPerLap` | Liters |
| Tyre compound | `acc.tireCompound` | String |
| Wind speed | `acc.windSpeed` | m/s |
| Wind direction | `acc.windDirection` | Degrees |

### Car Identity (Static)
| Field | Stored As | Units |
|-------|-----------|-------|
| Car model | `CarOrdinal` | Resolved from string |
| Track | `TrackOrdinal` | Resolved from string |

## Not Captured

### Physics Buffer (available but not read)
| Field | Reason |
|-------|--------|
| Wheel load (4 wheels, Newtons) | Not mapped to TelemetryPacket |
| Tyre dirty level (4 wheels) | Grip reduction from dirt — niche |
| Camber (4 wheels, radians) | Not mapped |
| Tyre middle surface temp (4 wheels) | Inner/outer captured, middle skipped |
| Brake disc life (4 wheels) | Disc wear — only pad wear captured |
| Wheel slip angle (separate from slip ratio) | Reused as combined slip |
| Lateral/longitudinal wheel forces | Not mapped |
| Local angular velocity (3-axis) | Not captured (0 in packet) |
| Final force feedback | Not telemetry |
| Performance meter | Not telemetry |
| Engine braking | Available but not read |
| Water temperature | Not mapped |
| ERS/KERS/DRS fields | Not applicable to GT3 cars |

### Graphics Buffer (available but not read)
| Field | Reason |
|-------|--------|
| Normalized car position (spline) | Derivable from distance |
| Other cars' positions (60 cars) | Multiplayer data |
| Penalty time | Niche |
| Rain lights / flashing lights | Visual state |
| Exhaust temperature | Not mapped |
| Driver stint time remaining | Endurance feature |
| Setup menu visibility | UI state |

### Static Buffer (available but not read)
| Field | Reason |
|-------|--------|
| Max torque / max power | Constant per car |
| Suspension max travel (4 wheels) | Constant per car |
| Tyre radius (4 wheels) | Constant per car |
| Max turbo boost | Constant per car |
| Track spline length | Track metadata |
| Dry/wet compound names | Derivable |
| Player name | Privacy |
| Pit window start/end | Strategy data |

## Key Characteristics

- **Richest tyre data** of all three games: surface (inner + outer), core, and display temperatures per wheel
- **Brake pad wear in mm** — only game with this
- **5-zone damage model** — front, rear, left, right, centre
- **Electronics readout** — TC, TC cut, ABS, engine map, brake bias all live
- **No angular velocity** — not available from shared memory (set to 0)
- **No power/torque** — not exposed via shared memory (set to 0)
- **Shared memory only** — must run on same machine as ACC, no network streaming
