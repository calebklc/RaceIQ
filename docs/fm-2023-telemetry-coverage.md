# Forza Motorsport 2023 Telemetry Coverage

What RaceIQ captures from the Forza Motorsport UDP telemetry stream.

## Data Source

UDP "Car Dash" format, 331 bytes per packet at 60 Hz. All values little-endian. Configured via in-game Gameplay Settings → HUD → Data Out.

## Captured Per Packet (60 Hz)

All fields from the 331-byte packet are captured. Forza provides a flat packet — no multi-packet accumulation needed.

### Session & Timing
| Field | Type | Units |
|-------|------|-------|
| IsRaceOn | s32 | 0=paused, 1=racing |
| TimestampMS | u32 | Milliseconds |
| CurrentLap | f32 | Seconds |
| LastLap | f32 | Seconds |
| BestLap | f32 | Seconds |
| CurrentRaceTime | f32 | Seconds |
| LapNumber | u16 | Count |
| RacePosition | u8 | Position |
| DistanceTraveled | f32 | Meters |

### Engine & Power
| Field | Type | Units |
|-------|------|-------|
| EngineMaxRpm | f32 | RPM |
| EngineIdleRpm | f32 | RPM |
| CurrentEngineRpm | f32 | RPM |
| Power | f32 | Watts |
| Torque | f32 | Newton-meters |
| Boost | f32 | PSI |

### Motion & Orientation
| Field | Type | Units |
|-------|------|-------|
| AccelerationX/Y/Z | f32 | m/s² |
| VelocityX/Y/Z | f32 | m/s |
| AngularVelocityX/Y/Z | f32 | rad/s |
| Yaw, Pitch, Roll | f32 | Radians |
| PositionX/Y/Z | f32 | Meters |
| Speed | f32 | m/s |

### Suspension
| Field | Type | Units |
|-------|------|-------|
| NormSuspensionTravel (4 wheels) | f32 | 0–1 (0=extended, 1=compressed) |
| SuspensionTravelMeters (4 wheels) | f32 | Meters |

### Tires
| Field | Type | Units |
|-------|------|-------|
| TireSlipRatio (4 wheels) | f32 | 0=grip, >1=slipping |
| TireSlipAngle (4 wheels) | f32 | Radians |
| TireCombinedSlip (4 wheels) | f32 | Combined magnitude |
| WheelRotationSpeed (4 wheels) | f32 | rad/s |
| TireTemp (4 wheels) | f32 | °F |
| TireWear (4 wheels) | f32 | 0–1 (0=new, 1=worn) |

### Wheel Surface
| Field | Type | Units |
|-------|------|-------|
| WheelOnRumbleStrip (4 wheels) | s32 | 0=off, 1=on kerb |
| WheelInPuddleDepth (4 wheels) | f32 | 0–1 depth |
| SurfaceRumble (4 wheels) | f32 | Force feedback intensity |

### Driver Inputs
| Field | Type | Units |
|-------|------|-------|
| Accel | u8 | 0–255 |
| Brake | u8 | 0–255 |
| Clutch | u8 | 0–255 |
| HandBrake | u8 | 0–255 |
| Gear | u8 | 0=R, 1=N, 2+=gears |
| Steer | s8 | -128 to 127 |

### Car Identity
| Field | Type | Units |
|-------|------|-------|
| CarOrdinal | s32 | Forza car ID |
| CarClass | s32 | 0–7 (S2, S1, A, B, C, D, E, F) |
| CarPerformanceIndex | s32 | PI rating (0–999) |
| DrivetrainType | s32 | 0=FWD, 1=RWD, 2=AWD |
| NumCylinders | s32 | Cylinder count |
| TrackOrdinal | s32 | Forza track ID |
| Fuel | f32 | Liters |

### Driving Aids
| Field | Type | Units |
|-------|------|-------|
| NormDrivingLine | s8 | Racing line position |
| NormAIBrakeDiff | s8 | AI brake assist |

## Not Captured

Forza's 331-byte Car Dash format is the only UDP output available. There are no additional packets or extensions. All fields in the packet are captured — **nothing is dropped**.

Extended telemetry (brake temps, setup values, damage percentages, traction control state) is **not available** in Forza's UDP output.
