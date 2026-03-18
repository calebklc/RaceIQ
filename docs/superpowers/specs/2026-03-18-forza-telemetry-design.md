# Forza Motorsport Telemetry Dashboard — Design Spec

## Overview

A local React app that connects to Forza Motorsport (2023) telemetry output, visualizes live data, records laps to SQLite, and exports lap summaries for Claude-assisted tune optimization.

## Stack

- **Runtime:** Bun (native UDP, WebSocket, SQLite)
- **API:** Hono
- **Frontend:** Vite + React + Tailwind CSS
- **Storage:** SQLite via `bun:sqlite`
- **Export:** Manual clipboard/file for Claude conversations

## Architecture

Single Bun process handles UDP ingestion, WebSocket broadcasting, REST API, and SQLite persistence. Vite React client connects via WebSocket for live data and REST for recorded laps.

```
Forza Motorsport (UDP :5300)
        │
        ▼
┌─────────────────────────────┐
│  Bun Server                 │
│  ┌─────────┐  ┌──────────┐ │
│  │ UDP     │→ │ Parser   │ │
│  │ Listener│  │ (331-byte│ │
│  └─────────┘  │ Car Dash)│ │
│               └────┬─────┘ │
│          ┌─────────┼───────┐│
│          ▼         ▼       ▼│
│  ┌──────────┐ ┌────────┐ ┌───────┐│
│  │ WebSocket│ │ Lap    │ │ Hono  ││
│  │ Broadcast│ │Detector│ │ REST  ││
│  │ (30Hz)  │ │→SQLite │ │ API   ││
│  └──────────┘ └────────┘ └───────┘│
└─────────────────────────────┘
        │              │
        ▼              ▼
┌─────────────────────────────┐
│  Vite React Client          │
│  - WebSocket live feed      │
│  - REST for lap history     │
│  - Export for Claude        │
└─────────────────────────────┘
```

## Telemetry Server

### UDP Listener
- Binds to configurable port (default `5300`)
- Receives 331-byte Car Dash packets at up to 60Hz
- Forza setting: Settings → Gameplay → Data Out → IP + Port

### Packet Parser
- Decodes 331-byte little-endian binary buffer into structured object
- All values little-endian. Field map (offset → type → name):

| Offset | Type | Field | Offset | Type | Field |
|--------|------|-------|--------|------|-------|
| 0 | s32 | IsRaceOn | 168 | f32 | TireTempFL |
| 4 | u32 | TimestampMS | 172 | f32 | TireTempFR |
| 8 | f32 | EngineMaxRpm | 176 | f32 | TireTempRL |
| 12 | f32 | EngineIdleRpm | 180 | f32 | TireTempRR |
| 16 | f32 | CurrentEngineRpm | 184 | f32 | Boost |
| 20 | f32 | AccelerationX | 188 | f32 | Fuel |
| 24 | f32 | AccelerationY | 192 | f32 | DistanceTraveled |
| 28 | f32 | AccelerationZ | 196 | f32 | BestLap |
| 32 | f32 | VelocityX | 200 | f32 | LastLap |
| 36 | f32 | VelocityY | 204 | f32 | CurrentLap |
| 40 | f32 | VelocityZ | 208 | f32 | CurrentRaceTime |
| 44 | f32 | AngularVelocityX | 212 | u16 | LapNumber |
| 48 | f32 | AngularVelocityY | 214 | u8 | RacePosition |
| 52 | f32 | AngularVelocityZ | 215 | u8 | Accel (0-255) |
| 56 | f32 | Yaw | 216 | u8 | Brake (0-255) |
| 60 | f32 | Pitch | 217 | u8 | Clutch (0-255) |
| 64 | f32 | Roll | 218 | u8 | HandBrake (0-255) |
| 68 | f32 | NormSuspensionTravelFL | 219 | u8 | Gear |
| 72 | f32 | NormSuspensionTravelFR | 220 | u8 | Steer (127=center) |
| 76 | f32 | NormSuspensionTravelRL | 221 | s8 | NormDrivingLine |
| 80 | f32 | NormSuspensionTravelRR | 222 | s8 | NormAIBrakeDiff |
| 84 | f32 | TireSlipRatioFL | 224 | f32 | TireWearFL |
| 88 | f32 | TireSlipRatioFR | 228 | f32 | TireWearFR |
| 92 | f32 | TireSlipRatioRL | 232 | f32 | TireWearRL |
| 96 | f32 | TireSlipRatioRR | 236 | f32 | TireWearRR |
| 100 | f32 | WheelRotationSpeedFL | 240 | s32 | SurfaceRumbleFL |
| 104 | f32 | WheelRotationSpeedFR | 244 | s32 | SurfaceRumbleFR |
| 108 | f32 | WheelRotationSpeedRL | 248 | s32 | SurfaceRumbleRL |
| 112 | f32 | WheelRotationSpeedRR | 252 | s32 | SurfaceRumbleRR |
| 116 | f32 | WheelOnRumbleStripFL | 256 | f32 | TireSlipAngleFL |
| 120 | f32 | WheelOnRumbleStripFR | 260 | f32 | TireSlipAngleFR |
| 124 | f32 | WheelOnRumbleStripRL | 264 | f32 | TireSlipAngleRL |
| 128 | f32 | WheelOnRumbleStripRR | 268 | f32 | TireSlipAngleRR |
| 132 | f32 | WheelInPuddleDepthFL | 272 | f32 | TireCombinedSlipFL |
| 136 | f32 | WheelInPuddleDepthFR | 276 | f32 | TireCombinedSlipFR |
| 140 | f32 | WheelInPuddleDepthRL | 280 | f32 | TireCombinedSlipRL |
| 144 | f32 | WheelInPuddleDepthRR | 284 | f32 | TireCombinedSlipRR |
| 148 | f32 | SurfaceRumbleFL_2 | 288 | f32 | SuspensionTravelMetersFL |
| 152 | f32 | SurfaceRumbleFR_2 | 292 | f32 | SuspensionTravelMetersFR |
| 156 | f32 | SurfaceRumbleRL_2 | 296 | f32 | SuspensionTravelMetersRL |
| 160 | f32 | SurfaceRumbleRR_2 | 300 | f32 | SuspensionTravelMetersRR |
| 164 | f32 | TireSlipCombinedFL_2 | 304 | s32 | CarOrdinal |
| | | | 308 | s32 | CarClass (0-7) |
| | | | 312 | s32 | CarPerformanceIndex |
| | | | 316 | s32 | DrivetrainType (0=FWD,1=RWD,2=AWD) |
| | | | 320 | s32 | NumCylinders |
| | | | 324 | s32 | CarCategory |
| | | | 328 | u8 | Unknown1 |
| | | | 329 | u8 | Unknown2 |
| | | | 330 | u8 | Unknown3 |

- Packets where `IsRaceOn == 0` are silently dropped (game paused/menu)

### WebSocket Broadcaster
- Bun native WebSocket on the same server
- Throttled to ~30 updates/sec (skip every other packet)
- Broadcasts parsed JSON to all connected clients

### Lap Detection
- Monitors `LapNumber` field for increments
- On lap boundary: use `LastLap` field from the first packet of the new lap as the authoritative lap time (game-calculated, more accurate than `CurrentLap` at boundary)
- **Rewind detection:** if `TimestampMS` decreases by any amount OR jumps backward, mark the current in-progress lap as `is_valid = false`. Continue recording — invalid laps are still stored for analysis but flagged.
- **Session detection:** create a new session when:
  - `CarOrdinal` or `TrackOrdinal` changes, OR
  - No packets received for >30 seconds (game restart, loading screen, reconnection)

### REST API (Hono)
- `GET /api/status` — server health: UDP receiving (bool), packets/sec, connected WS clients, current session info
- `GET /api/laps` — list recorded laps with metadata (lap number, time, car, track, valid)
- `GET /api/laps/:id` — full decompressed telemetry for a lap
- `GET /api/laps/:id/export` — Claude-formatted summary (see Export Format)
- `DELETE /api/laps/:id` — remove a lap
- `GET /api/sessions` — list sessions

### Error Handling
- **Malformed UDP packets:** if packet length != 331 bytes, silently drop and increment a `droppedPackets` counter (exposed via `/api/status`)
- **`IsRaceOn == 0`:** silently drop (game paused/in menu)
- **SQLite write failure:** log error, do not crash — lap telemetry buffer is lost but server continues
- **No WebSocket clients:** packets are still parsed and buffered for lap detection, just not broadcast
- **WebSocket send failure:** remove dead client from broadcast list, log warning

## Data Model

### SQLite Schema

```sql
CREATE TABLE sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  car_ordinal   INTEGER NOT NULL,
  track_ordinal INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE laps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lap_number  INTEGER NOT NULL,
  lap_time    REAL NOT NULL,
  is_valid    BOOLEAN NOT NULL DEFAULT 1,
  telemetry   BLOB NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_laps_session ON laps(session_id);
```

### Telemetry Storage
- Full packet array stored as gzip-compressed JSON blob (`Bun.gzipSync` / `Bun.gunzipSync`)
- ~1,800 packets per 60s lap at 30Hz
- ~10:1 compression ratio on repetitive float data

### Export Format for Claude
Structured summary per lap, example output:

```
=== Forza Motorsport Lap Export ===
Car: #342 | Class: S (PI 812) | Drivetrain: RWD
Track: #105 | Lap: 3 | Time: 1:23.456 | Valid: Yes

--- Performance Summary ---
Speed (mph):    min=12.3  avg=98.7  max=162.4
RPM:            min=2100  avg=6800  max=8500
Throttle:       avg=72%   full=58%
Brake:          avg=18%   full=12%

--- Tire Temps (avg °F) ---
FL: 198  FR: 205  RL: 212  RR: 218

--- Gear Distribution ---
2nd: 8% | 3rd: 22% | 4th: 35% | 5th: 28% | 6th: 7%

--- Braking Zones (top 5 by speed delta) ---
1. Speed 155→62 mph at pos (234.1, -12.3, 891.2)
2. Speed 148→55 mph at pos (102.4, -11.8, 445.7)
...

--- Suspension Travel (avg meters) ---
FL: 0.12  FR: 0.11  RL: 0.14  RR: 0.15

--- Tire Wear ---
FL: 0.92  FR: 0.89  RL: 0.95  RR: 0.94

Paste this into a Claude conversation for tuning advice.
```

- Designed to fit within Claude conversation context (~500 tokens per lap)

## Client (Vite React)

### Initial Scope (Telemetry-First)
Minimal UI to verify data pipeline:

1. **ConnectionStatus** — WebSocket connected/disconnected, packets/sec counter
2. **LiveTelemetry** — real-time key values: speed, RPM, gear, lap number, current lap time, throttle %, brake %
3. **LapList** — table of recorded laps from SQLite with metadata
4. **ExportButton** — copies Claude-formatted lap summary to clipboard

### State Management
- React state + custom `useWebSocket` hook
- No external state library needed at this stage

### Styling
- Tailwind CSS for quick iteration

## Project Structure

```
forza-telemetry/
├── server/
│   ├── index.ts          -- Bun entry, wires UDP + Hono + WS
│   ├── udp.ts            -- UDP socket listener
│   ├── parser.ts         -- Car Dash 331-byte binary decoder
│   ├── ws.ts             -- WebSocket broadcaster with throttle
│   ├── db.ts             -- SQLite schema, queries, compression
│   ├── routes.ts         -- Hono REST routes
│   └── lap-detector.ts   -- Lap boundary detection + session mgmt
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── components/
│   │   │   ├── ConnectionStatus.tsx
│   │   │   ├── LiveTelemetry.tsx
│   │   │   ├── LapList.tsx
│   │   │   └── ExportButton.tsx
│   │   └── lib/
│   │       └── types.ts
│   ├── index.html
│   └── vite.config.ts
├── shared/
│   └── types.ts          -- Packet field definitions
├── package.json
└── README.md
```

### Dev Workflow
- Single `bun run dev` starts Bun server + Vite dev server concurrently
- Vite proxy config forwards `/api/*` and WebSocket upgrades to the Bun server (avoids CORS issues in dev)
- Forza configured to send UDP to `127.0.0.1:5300`

### Types Strategy
- `shared/types.ts` — canonical packet field definitions, exported interfaces (`TelemetryPacket`, `LapMeta`, etc.)
- `client/src/lib/types.ts` — removed; client imports directly from `shared/types.ts` via Vite alias
- Car/track ordinal-to-name lookup tables are deferred — out of scope for v1, ordinals displayed as numbers

## Decisions & Trade-offs

1. **Bun over Node.js** — native UDP, WebSocket, and SQLite eliminate 3 dependencies
2. **Hono over Express** — lightweight, built for Bun, fast
3. **BLOB over normalized rows** — telemetry only accessed as full lap array, avoids millions of rows
4. **30Hz throttle** — halves bandwidth to client with no perceptible loss for visualization
5. **Manual Claude export over API** — no API key management, user controls what data is shared
6. **Gzip compression** — significant storage savings on repetitive float data with negligible CPU cost
