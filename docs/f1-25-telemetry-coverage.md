# F1 25 Telemetry Coverage

What RaceIQ captures from the F1 25 UDP telemetry stream.

## Captured Per Packet (60 Hz)

### Motion (Packet 0)
| Field | Stored As |
|-------|-----------|
| World position X/Y/Z | `PositionX`, `PositionY`, `PositionZ` |
| World velocity X/Y/Z | `VelocityX`, `VelocityY`, `VelocityZ` |
| G-force lateral/longitudinal/vertical | `AccelerationX`, `AccelerationY`, `AccelerationZ` |
| Yaw, pitch, roll | `Yaw`, `Pitch`, `Roll` |

### MotionEx (Packet 13) — Player Car Only
| Field | Stored As |
|-------|-----------|
| Suspension position (4 wheels) | `NormSuspensionTravelXX`, `SuspensionTravelMetersXX` |
| Wheel speed (4 wheels) | `WheelRotationSpeedXX` |
| Wheel slip ratio (4 wheels) | `TireSlipRatioXX` |
| Wheel slip angle (4 wheels) | `TireSlipAngleXX`, `f1.motionEx.wheelSlipAngleXX` |
| Wheel lateral force (4 wheels) | `f1.motionEx.wheelLatForceXX` |
| Wheel longitudinal force (4 wheels) | `f1.motionEx.wheelLongForceXX` |
| Wheel vertical force (4 wheels) | `f1.motionEx.wheelVertForceXX` |
| Angular velocity X/Y/Z | `AngularVelocityX/Y/Z` |
| Front wheels angle | `f1.motionEx.frontWheelsAngle` |
| Front/rear aero height | `f1.motionEx.frontAeroHeight`, `rearAeroHeight` |
| Front/rear roll angle | `f1.motionEx.frontRollAngle`, `rearRollAngle` |
| Chassis yaw/pitch | `f1.motionEx.chassisYaw`, `chassisPitch` |
| Height of COG above ground | `f1.motionEx.heightOfCOGAboveGround` |
| Combined slip (derived) | `TireCombinedSlipXX` |

### Car Telemetry (Packet 6)
| Field | Stored As |
|-------|-----------|
| Speed | `Speed` |
| Throttle | `Accel` (0-255) |
| Brake | `Brake` (0-255) |
| Clutch | `Clutch` (0-255) |
| Gear | `Gear` |
| Engine RPM | `CurrentEngineRpm` |
| DRS active | `f1.drsActivated` |
| Tyre surface temperature (4 wheels) | `TireTempXX` |
| Tyre inner temperature (4 wheels) | `f1.tyresInnerTempXX` |
| Brake temperature (4 wheels) | `f1.brakeTempXX` |
| Tyre pressure (4 wheels) | `f1.tyrePressureXX` |
| Engine temperature | `f1.engineTemperature` |
| Surface type (4 wheels) | `f1.surfaceTypeXX` |
| Suggested gear | `f1.suggestedGear` |
| Steering | `Steer` |

### Car Status (Packet 7)
| Field | Stored As |
|-------|-----------|
| Fuel in tank / capacity | `Fuel` (ratio) |
| Fuel remaining laps | `f1.fuelRemainingLaps` |
| Tyre compound (actual + visual) | `f1.tyreCompound`, `f1.tyreVisualCompound` |
| Tyre age (laps) | `f1.tyreAge` |
| ERS store energy | `f1.ersStoreEnergy` |
| ERS deploy mode | `f1.ersDeployMode` |
| ERS deployed this lap | `f1.ersDeployedThisLap` |
| ERS harvested this lap | `f1.ersHarvestedThisLap` |
| DRS allowed | `f1.drsAllowed` |
| DRS activation distance | `f1.drsActivationDistance` |
| Engine power ICE (watts) | `f1.enginePowerICE` |
| Engine power MGU-K (watts) | `f1.enginePowerMGUK` |
| Combined power (hp) | `Power` |
| Max/idle RPM | `EngineMaxRpm`, `EngineIdleRpm` |
| Traction control | `f1.tractionControl` |
| Anti-lock brakes | `f1.antiLockBrakes` |
| Fuel mix | `f1.fuelMix` |
| Front brake bias | `f1.frontBrakeBias` |
| Pit limiter status | `f1.pitLimiterStatus` |
| Vehicle FIA flags | `f1.vehicleFIAFlags` |

### Car Damage (Packet 10)
| Field | Stored As | Note |
|-------|-----------|------|
| Tyre wear (4 wheels, 0-100%) | `TireWearXX` (normalized 0-1) | |
| Tyre damage (4 wheels) | `f1.tyresDamageXX` | |
| Brake damage (4 wheels) | `f1.brakesDamageXX` | |
| Tyre blisters (4 wheels) | `f1.tyreBlistersXX` | |
| Front wing damage (L/R) | `f1.frontLeftWingDamage`, `frontRightWingDamage` | **Live UI only** |
| Rear wing damage | `f1.rearWingDamage` | **Live UI only** |
| Floor damage | `f1.floorDamage` | **Live UI only** |
| Diffuser damage | `f1.diffuserDamage` | **Live UI only** |
| Sidepod damage | `f1.sidepodDamage` | **Live UI only** |
| DRS fault | `f1.drsFault` | **Live UI only** |
| ERS fault | `f1.ersFault` | **Live UI only** |
| Gearbox damage | `f1.gearBoxDamage` | **Live UI only** |
| Engine damage | `f1.engineDamage` | **Live UI only** |
| Engine MGU-H wear | `f1.engineMGUHWear` | **Live UI only** |
| Engine ES wear | `f1.engineESWear` | **Live UI only** |
| Engine CE wear | `f1.engineCEWear` | **Live UI only** |
| Engine ICE wear | `f1.engineICEWear` | **Live UI only** |
| Engine MGU-K wear | `f1.engineMGUKWear` | **Live UI only** |
| Engine TC wear | `f1.engineTCWear` | **Live UI only** |

### Lap Data (Packet 2)
| Field | Stored As |
|-------|-----------|
| Current lap time | `CurrentLap` |
| Last lap time | `LastLap` |
| Best lap time | `BestLap` |
| Lap number | `LapNumber` |
| Race position | `RacePosition` |
| Lap distance / total distance | `DistanceTraveled` |
| Current sector | `f1.currentSector` |
| Sector 1/2 times | `f1.sector1Time`, `sector2Time` |
| Current lap invalid | `f1.currentLapInvalid` |
| Penalties (seconds) | `f1.penalties` |
| Total warnings | `f1.totalWarnings` |
| Corner cutting warnings | `f1.cornerCuttingWarnings` |
| Driver status | `f1.driverStatus` |
| Pit lane timer active | `f1.pitLaneTimerActive` |
| Pit lane time (ms) | `f1.pitLaneTimeInLaneInMS` |
| Speed trap fastest speed | `f1.speedTrapFastestSpeed` |
| Grid position | `f1.gridPosition` |
| All cars: position, lap times, pit status | `f1.grid[]` |

### Session (Packet 1)
| Field | Stored As |
|-------|-----------|
| Weather | `f1.weather` |
| Track temperature | `f1.trackTemperature` |
| Air temperature | `f1.airTemperature` |
| Rain percentage | `f1.rainPercentage` |
| Session type | `f1.sessionType` |
| Total laps | `f1.totalLaps` |
| Safety car status | `f1.safetyCarStatus` |
| Track length | `f1.trackLength` |
| Pit speed limit | `f1.pitSpeedLimit` |
| Formula | `f1.formula` |
| Pit stop window (ideal/latest lap) | `f1.pitStopWindowIdealLap`, `pitStopWindowLatestLap` |

### Car Setup (Packet 5)
| Field | Stored As |
|-------|-----------|
| Front/rear wing | `f1.setup.frontWing`, `rearWing` |
| Differential on/off throttle | `f1.setup.onThrottle`, `offThrottle` |
| Front/rear camber | `f1.setup.frontCamber`, `rearCamber` |
| Front/rear toe | `f1.setup.frontToe`, `rearToe` |
| Front/rear suspension | `f1.setup.frontSuspension`, `rearSuspension` |
| Front/rear anti-roll bar | `f1.setup.frontAntiRollBar`, `rearAntiRollBar` |
| Front/rear ride height | `f1.setup.frontRideHeight`, `rearRideHeight` |
| Brake pressure / bias / engine braking | `f1.setup.brakePressure`, `brakeBias`, `engineBraking` |
| Tyre pressures (4 wheels) | `f1.setup.frontLeftTyrePressure`, etc. |
| Fuel load | `f1.setup.fuelLoad` |

### Participants (Packet 4) — **Live UI only**
| Field | Stored As |
|-------|-----------|
| Driver ID, team ID, name | `f1.grid[].driverName`, `teamId` |

### Session History (Packet 11) — **Live UI only**
| Field | Stored As |
|-------|-----------|
| Best/last sector times per driver | Used for grid gap calculations |
| Best lap time per driver | `f1.grid[].bestLapTime` |

## Per Lap (Database Column)

| Field | Column |
|-------|--------|
| Car setup snapshot | `car_setup` (JSON) |

## Not Captured

These packets are session-level metadata that don't fit the per-packet telemetry model:

| Packet | ID | Reason |
|--------|----|--------|
| Events | 3 | Discrete events (fastest lap, penalties, collisions) — not continuous telemetry |
| Final Classification | 8 | End-of-race summary — single occurrence |
| Lobby Info | 9 | Multiplayer lobby data — pre-session |
| Tyre Sets | 12 | Available tyre sets — changes only at pit stops |
| Time Trial | 14 | Time trial specific data — niche use case |
| Lap Positions | 15 | Position chart data — reconstructable from lap data |

### Dropped Fields (parsed but not stored)

These fields from captured packets are read but not included in stored telemetry:

| Field | Packet | Reason |
|-------|--------|--------|
| Forward/right direction vectors | Motion | Derivable from yaw/pitch/roll |
| Suspension acceleration (4 wheels) | MotionEx | Derivable from suspension velocity |
| Wheel camber / camber gain (4 wheels) | MotionEx | Rarely needed for analysis |
| Rev lights percent / bit value | CarTelemetry | Visual indicator, not telemetry |
| Network paused | CarStatus | Multiplayer-only flag |
| Max gears | CarStatus | Constant per car |
| Session time left / duration | Session | Timing, not telemetry |
| Marshal zones | Session | Track metadata, not telemetry |
| Weather forecast samples | Session | Prediction data, not current state |
| All assist settings | Session | Constant per session |
| All ruleset/gameplay settings | Session | Constant per session |
| Sector distance start values | Session | Track metadata |
