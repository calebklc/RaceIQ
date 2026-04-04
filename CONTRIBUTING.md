# Contributing

## Requirements

- [Bun](https://bun.sh)

## Development

```bash
bun install
cd client && bun install && cd ..
bun run dev
```

- Server + API: `http://localhost:3117`
- Client (Vite HMR): `http://localhost:5173`
- Data is stored in `./data/`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Database | SQLite + [Drizzle ORM](https://orm.drizzle.team) |
| Frontend | React 19, Vite, TypeScript |
| Routing | TanStack Router (file-based) |
| State | Zustand (client), TanStack Query (server) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | uPlot |
| 3D | Three.js + React Three Fiber |
| AI | Claude API |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `3117` | HTTP/WebSocket port |
| `UDP_PORT` | `5300` | Telemetry UDP port |
| `DATA_DIR` | `./data` | Database and settings directory |

## Tests

```bash
bun test
bun test test/parser.test.ts   # single file
```

## Track Data

Built-in track outlines and metadata are extracted from game files:

```bash
bun run extract:tracks        # all supported games
bun run extract:tracks:forza  # Forza Motorsport only
bun run extract:tracks:f1     # F1 2025 only
```

Extracted data is written to `shared/track-outlines/` and `shared/tracks.csv`.

## Database

```bash
bun run db:push       # push schema changes
bun run db:generate   # generate migration files
```

## Game Configuration

### Forza Motorsport

1. Go to **Settings > HUD and Gameplay**
2. Set **Data Out** to `On`
3. Set **Data Out IP Address** to `127.0.0.1`
4. Set **Data Out Port** to `5300`
5. Set **Data Out Package Format** to `Car Dash`

### F1 2025

1. Go to **Settings > Telemetry Settings**
2. Set **UDP Telemetry** to `On`
3. Set **UDP Broadcast Mode** to `Off`
4. Set **UDP IP Address** to `127.0.0.1`
5. Set **UDP Port** to `5300`

### Assetto Corsa Competizione

No UDP configuration needed. RaceIQ reads telemetry directly via shared memory. Run RaceIQ on the same machine as the game.
