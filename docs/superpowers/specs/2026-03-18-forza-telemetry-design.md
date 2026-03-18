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
- ~85 fields including: position (x/y/z), speed, RPM, gear, throttle, brake, steer, tire temps (4), suspension travel (4), wheel rotation speed (4), lap timing, fuel, car/track ordinals
- Field map based on Forza Motorsport Car Dash specification

### WebSocket Broadcaster
- Bun native WebSocket on the same server
- Throttled to ~30 updates/sec (skip every other packet)
- Broadcasts parsed JSON to all connected clients

### Lap Detection
- Monitors `LapNumber` field for increments
- On lap boundary: flush buffered telemetry to SQLite
- Detects rewind/reset via timestamp discontinuities → marks lap as invalid
- Creates new session when `CarOrdinal` or `TrackOrdinal` changes

### REST API (Hono)
- `GET /api/laps` — list recorded laps with metadata (lap number, time, car, track, valid)
- `GET /api/laps/:id` — full decompressed telemetry for a lap
- `GET /api/laps/:id/export` — Claude-formatted summary (see Export Format)
- `DELETE /api/laps/:id` — remove a lap
- `GET /api/sessions` — list sessions

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
Structured summary per lap:
- Lap time, car ordinal, track ordinal
- Min/max/avg for: speed, RPM, throttle %, brake %, tire temps (FL/FR/RL/RR), suspension travel
- Gear usage distribution (% time in each gear)
- Brake points (speed deltas > threshold with position)
- Designed to fit within Claude conversation context

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
- Forza configured to send UDP to `127.0.0.1:5300`

## Decisions & Trade-offs

1. **Bun over Node.js** — native UDP, WebSocket, and SQLite eliminate 3 dependencies
2. **Hono over Express** — lightweight, built for Bun, fast
3. **BLOB over normalized rows** — telemetry only accessed as full lap array, avoids millions of rows
4. **30Hz throttle** — halves bandwidth to client with no perceptible loss for visualization
5. **Manual Claude export over API** — no API key management, user controls what data is shared
6. **Gzip compression** — significant storage savings on repetitive float data with negligible CPU cost
