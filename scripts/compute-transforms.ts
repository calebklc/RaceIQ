#!/usr/bin/env bun
/**
 * Compute Procrustes transforms for all tracks with stored laps.
 * Outputs the transforms so we can hardcode them.
 */
import { db } from "../server/db";
import { laps, sessions } from "../server/db/schema";
import { eq, sql } from "drizzle-orm";
import { parseForzaPacket } from "../server/parsers/forza";
import { loadOutline } from "../server/track-outlines";
import { procrustes } from "../server/track-calibration";

// Get all unique track ordinals with laps
const tracks = db.select({
  trackOrdinal: sessions.trackOrdinal,
  gameId: sessions.gameId,
  count: sql<number>`count(*)`,
}).from(laps)
  .innerJoin(sessions, eq(laps.sessionId, sessions.id))
  .groupBy(sessions.trackOrdinal, sessions.gameId)
  .all();

console.log(`Found ${tracks.length} tracks with laps:\n`);

for (const track of tracks) {
  const { trackOrdinal, gameId, count } = track;
  console.log(`\n=== Track ${trackOrdinal} (${gameId}), ${count} laps ===`);
  
  // Load the outline
  const outline = loadOutline(trackOrdinal, gameId);
  if (!outline) {
    console.log("  No outline available, skipping");
    continue;
  }
  console.log(`  Outline: ${outline.points.length} points, source: ${outline.source}`);
  if (outline.source === "recorded" || outline.source === "extracted") {
    console.log("  Already in Forza coords, skipping");
    continue;
  }
  
  // Get one lap with telemetry
  const lapRow = db.select({
    telemetry: laps.telemetry,
  }).from(laps)
    .innerJoin(sessions, eq(laps.sessionId, sessions.id))
    .where(eq(sessions.trackOrdinal, trackOrdinal))
    .limit(1)
    .get();
  
  if (!lapRow?.telemetry) {
    console.log("  No telemetry data, skipping");
    continue;
  }

  // Parse telemetry
  const buf = Buffer.from(lapRow.telemetry);
  const packetSize = 331;
  const packets = [];
  for (let i = 0; i + packetSize <= buf.length; i += packetSize) {
    const pkt = parseForzaPacket(buf.subarray(i, i + packetSize));
    if (pkt && (pkt.PositionX !== 0 || pkt.PositionZ !== 0)) {
      packets.push({ x: pkt.PositionX, z: pkt.PositionZ });
    }
  }
  console.log(`  Telemetry positions: ${packets.length}`);
  
  if (packets.length < 50) {
    console.log("  Too few positions, skipping");
    continue;
  }

  // Downsample both to ~200 points
  const downsample = (pts: {x:number,z:number}[], n: number) => {
    if (pts.length <= n) return pts;
    const step = pts.length / n;
    return Array.from({length: n}, (_, i) => pts[Math.floor(i * step)]);
  };

  const outPts = downsample(outline.points, 200);
  const lapPts = downsample(packets, 200);
  
  const transform = procrustes(outPts, lapPts);
  console.log(`  Transform: ${JSON.stringify(transform)}`);
}
