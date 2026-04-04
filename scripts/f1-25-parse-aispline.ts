/**
 * Parse AI Spline data from F1 25 ERP archives
 * Extracts track geometry: gates (center line points), racing limits, track limits
 *
 * The aispline data is stored in BXML (Binary XML) format inside ERP archives.
 *
 * BXML format:
 *   byte    0x01 (start element)
 *   string  "BXML" (magic)
 *   ... nested elements with:
 *     0x01 = start element with attributes
 *     0x02 = start element with attributes (variant)
 *     0x03 = start element with attributes (variant)
 *     0x04 = end element
 *     0x05 = end element (variant)
 *   strings are null-terminated
 *   uint32 LE prefix on some element types indicates content length
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as fzstd from 'fzstd';

const ERP_MAGIC = 0x4b505245;

function readErpAndExtract(erpPath: string, resourcePattern: string): Buffer[] {
  const buffer = Buffer.from(readFileSync(erpPath));
  let pos = 0;
  const readUint32 = () => { const v = buffer.readUInt32LE(pos); pos += 4; return v; };
  const readInt32 = () => { const v = buffer.readInt32LE(pos); pos += 4; return v; };
  const readUint16 = () => { const v = buffer.readUInt16LE(pos); pos += 2; return v; };
  const readByte = () => buffer[pos++];
  const readUint64 = () => { const v = buffer.readBigUInt64LE(pos); pos += 8; return v; };
  const skip = (n: number) => { pos += n; };
  const readStr = (n: number) => {
    const bytes = buffer.subarray(pos, pos + n); pos += n;
    let end = bytes.indexOf(0); if (end === -1) end = n;
    return bytes.subarray(0, end).toString('utf-8');
  };

  const magic = readUint32();
  if (magic !== ERP_MAGIC) throw new Error('Not an ERP file');
  const version = readInt32();
  skip(24);
  const resourceOffset = readUint64();
  skip(8);
  const numFiles = readInt32();
  readInt32(); // numTempFiles

  const results: Buffer[] = [];

  for (let i = 0; i < numFiles; i++) {
    readUint32(); // entryInfoLength
    const idLen = readUint16();
    const id = readStr(idLen);
    const resType = readStr(16);
    readInt32();
    if (version >= 4) readUint16();
    const fragCount = readByte();

    const frags: { offset: bigint; size: bigint; packedSize: bigint; compression: number }[] = [];
    for (let j = 0; j < fragCount; j++) {
      readStr(4); // name
      const offset = readUint64();
      const size = readUint64();
      readInt32(); // flags
      let compression = 0, packedSize = 0n;
      if (version > 2) { compression = readByte(); packedSize = readUint64(); }
      frags.push({ offset, size, packedSize, compression });
    }
    if (version > 2) skip(16); // hash

    if (id.toLowerCase().includes(resourcePattern.toLowerCase())) {
      for (const frag of frags) {
        const dataOff = Number(resourceOffset) + Number(frag.offset);
        const dataLen = Number(frag.packedSize || frag.size);
        const raw = buffer.subarray(dataOff, dataOff + dataLen);
        if (frag.compression === 0x11) {
          results.push(Buffer.from(fzstd.decompress(new Uint8Array(raw))));
        } else {
          results.push(Buffer.from(raw));
        }
      }
    }
  }
  return results;
}

interface Gate {
  id: number;
  name: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  waypoints: {
    id: number;
    type: string;
    length: number;
  }[];
}

function parseBXML(data: Buffer): Gate[] {
  const gates: Gate[] = [];
  // The BXML format stores null-terminated strings with byte-type prefixes
  // Let's parse it by scanning for gate data patterns

  let pos = 0;
  const text = data.toString('utf-8'); // It's essentially null-separated strings with control bytes

  // Alternative approach: split by null bytes and parse sequentially
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      if (i > start) {
        const s = data.subarray(start, i).toString('utf-8');
        // Filter out control characters that aren't printable
        if (s.length > 0 && s.charCodeAt(0) >= 0x20) {
          parts.push(s);
        }
      }
      start = i + 1;
    } else if (data[i] < 0x20 && data[i] !== 0x09 && data[i] !== 0x0a && data[i] !== 0x0d) {
      // Control byte - save what we have and skip
      if (i > start) {
        const s = data.subarray(start, i).toString('utf-8');
        if (s.length > 0 && s.charCodeAt(0) >= 0x20) {
          parts.push(s);
        }
      }
      start = i + 1;
    }
  }

  // Now parse the string sequence to extract gate data
  let i = 0;
  let currentGate: Partial<Gate> | null = null;
  let inWaypoints = false;
  let currentWaypoint: Partial<{ id: number; type: string; length: number }> | null = null;

  while (i < parts.length) {
    const p = parts[i];

    if (p === 'gate' && i + 1 < parts.length && parts[i + 1] === 'id') {
      // Start of a gate element
      if (currentGate && currentGate.position) {
        gates.push(currentGate as Gate);
      }
      currentGate = {
        id: parseInt(parts[i + 2]),
        name: '',
        position: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 0, z: 0 },
        waypoints: [],
      };
      if (parts[i + 3] === 'name') {
        currentGate.name = parts[i + 4];
        i += 5;
      } else {
        i += 3;
      }
      inWaypoints = false;
      continue;
    }

    if (p === 'position' && currentGate && !inWaypoints) {
      // Position: x, y, z
      if (parts[i + 1] === 'x') {
        currentGate.position = {
          x: parseFloat(parts[i + 2]),
          y: parseFloat(parts[i + 4]),
          z: parseFloat(parts[i + 6]),
        };
        i += 7;
        continue;
      }
    }

    if (p === 'normal' && currentGate && !inWaypoints) {
      if (parts[i + 1] === 'x') {
        currentGate.normal = {
          x: parseFloat(parts[i + 2]),
          y: parseFloat(parts[i + 4]),
          z: parseFloat(parts[i + 6]),
        };
        i += 7;
        continue;
      }
    }

    if (p === 'waypoints' && currentGate) {
      inWaypoints = true;
      // skip num_waypoints
      i += 1;
      continue;
    }

    if (p === 'waypoint' && inWaypoints && currentGate) {
      if (parts[i + 1] === 'id') {
        const wpId = parseInt(parts[i + 2]);
        let wpType = '';
        let wpLength = 0;
        let j = i + 3;
        if (parts[j] === 'type') {
          wpType = parts[j + 1];
          j += 2;
        }
        if (parts[j] === 'length') {
          wpLength = parseFloat(parts[j + 1]);
          j += 2;
        }
        currentGate.waypoints!.push({ id: wpId, type: wpType, length: wpLength });
        i = j;
        continue;
      }
    }

    i++;
  }

  // Push last gate
  if (currentGate && currentGate.position) {
    gates.push(currentGate as Gate);
  }

  return gates;
}

async function main() {
  const erpPath = process.argv[2] || 'C:/Program Files (x86)/Steam/steamapps/common/F1 25/2025_asset_groups/environment_package/tracks/abu_dhabi/wep/abu_dhabi_common.erp';
  const outputDir = process.argv[3] || 'C:/Users/acoop/Documents/GitHub/RaceIQ/scripts/track-data';

  console.log(`Reading ERP: ${erpPath}`);
  const fragments = readErpAndExtract(erpPath, 'aispline');
  console.log(`Found ${fragments.length} fragments`);

  if (fragments.length === 0) {
    console.error('No aispline data found!');
    process.exit(1);
  }

  const bxmlData = fragments[0]; // Main spline data
  console.log(`BXML data size: ${bxmlData.length} bytes`);

  const gates = parseBXML(bxmlData);
  console.log(`Parsed ${gates.length} gates`);

  if (gates.length > 0) {
    console.log('\nFirst 5 gates:');
    for (let i = 0; i < Math.min(5, gates.length); i++) {
      const g = gates[i];
      console.log(`  Gate ${g.id} (${g.name}): pos=(${g.position.x}, ${g.position.y}, ${g.position.z}) normal=(${g.normal.x}, ${g.normal.y}, ${g.normal.z})`);
      for (const wp of g.waypoints) {
        console.log(`    Waypoint ${wp.id}: ${wp.type} length=${wp.length}`);
      }
    }

    console.log('\nLast 3 gates:');
    for (let i = Math.max(0, gates.length - 3); i < gates.length; i++) {
      const g = gates[i];
      console.log(`  Gate ${g.id} (${g.name}): pos=(${g.position.x}, ${g.position.y}, ${g.position.z})`);
    }

    // Extract center line, left/right track limits, left/right racing limits
    const centerLine = gates.map(g => g.position);
    const leftTrackLimit = gates.map(g => {
      const wp = g.waypoints.find(w => w.type === 'left_track_limit');
      if (!wp) return null;
      return {
        x: g.position.x + g.normal.x * wp.length, // Perpendicular offset? Actually normal might be the forward direction
        y: g.position.y + g.normal.y * wp.length,
        z: g.position.z + g.normal.z * wp.length,
        length: wp.length,
      };
    });
    const rightTrackLimit = gates.map(g => {
      const wp = g.waypoints.find(w => w.type === 'right_track_limit');
      if (!wp) return null;
      return {
        x: g.position.x + g.normal.x * wp.length,
        y: g.position.y + g.normal.y * wp.length,
        z: g.position.z + g.normal.z * wp.length,
        length: wp.length,
      };
    });

    // Compute track width stats
    const widths = gates.map(g => {
      const left = g.waypoints.find(w => w.type === 'left_track_limit');
      const right = g.waypoints.find(w => w.type === 'right_track_limit');
      if (left && right) return Math.abs(right.length - left.length);
      return null;
    }).filter((w): w is number => w !== null);

    if (widths.length > 0) {
      console.log(`\nTrack width stats (${widths.length} measurements):`);
      console.log(`  Min: ${Math.min(...widths).toFixed(2)}m`);
      console.log(`  Max: ${Math.max(...widths).toFixed(2)}m`);
      console.log(`  Avg: ${(widths.reduce((a, b) => a + b, 0) / widths.length).toFixed(2)}m`);
    }

    // List all waypoint types
    const allTypes = new Set<string>();
    for (const g of gates) {
      for (const wp of g.waypoints) {
        allTypes.add(wp.type);
      }
    }
    console.log(`\nWaypoint types: ${[...allTypes].join(', ')}`);

    // Save output
    mkdirSync(outputDir, { recursive: true });

    const output = {
      trackName: 'abu_dhabi',
      gateCount: gates.length,
      waypointTypes: [...allTypes],
      gates: gates.map(g => ({
        id: g.id,
        name: g.name,
        x: g.position.x,
        y: g.position.y,
        z: g.position.z,
        nx: g.normal.x,
        ny: g.normal.y,
        nz: g.normal.z,
        waypoints: g.waypoints,
      })),
    };

    const outFile = join(outputDir, 'abu_dhabi_aispline.json');
    writeFileSync(outFile, JSON.stringify(output, null, 2));
    console.log(`\nSaved to: ${outFile}`);
  }
}

main().catch(console.error);
