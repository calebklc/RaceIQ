/**
 * ERP Resource Extractor - extracts and decompresses resources from ERP archives
 * Supports ZStandard (compression type 0x11/17) decompression
 *
 * Usage:
 *   bun run scripts/erp-extract.ts <file.erp> <resource-pattern> [--output <dir>]
 *   bun run scripts/erp-extract.ts <file.erp> --list-types
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import * as fzstd from 'fzstd';

const ERP_MAGIC = 0x4b505245; // "ERPK" in LE

interface ErpHeader {
  magic: number;
  version: number;
  resourceOffset: bigint;
  numFiles: number;
  numTempFiles: number;
}

interface ErpFragment {
  name: string;
  offset: bigint;
  size: bigint;
  flags: number;
  compression: number;
  packedSize: bigint;
}

interface ErpResource {
  identifier: string;
  resourceType: string;
  fragments: ErpFragment[];
}

interface ErpFile {
  header: ErpHeader;
  resources: ErpResource[];
}

function readErpFile(buffer: Buffer): ErpFile {
  let pos = 0;
  const readUint32 = () => { const v = buffer.readUInt32LE(pos); pos += 4; return v; };
  const readInt32 = () => { const v = buffer.readInt32LE(pos); pos += 4; return v; };
  const readUint16 = () => { const v = buffer.readUInt16LE(pos); pos += 2; return v; };
  const readByte = () => buffer[pos++];
  const readUint64 = () => { const v = buffer.readBigUInt64LE(pos); pos += 8; return v; };
  const skip = (n: number) => { pos += n; };
  const readString = (n: number) => {
    const bytes = buffer.subarray(pos, pos + n);
    pos += n;
    let end = bytes.indexOf(0);
    if (end === -1) end = n;
    return bytes.subarray(0, end).toString('utf-8');
  };

  const magic = readUint32();
  if (magic !== ERP_MAGIC) throw new Error(`Invalid magic: 0x${magic.toString(16)}`);
  const version = readInt32();
  skip(8); skip(8); skip(8);
  const resourceOffset = readUint64();
  skip(8);
  const numFiles = readInt32();
  const numTempFiles = readInt32();

  const resources: ErpResource[] = [];
  for (let i = 0; i < numFiles; i++) {
    readUint32(); // entryInfoLength
    const idLen = readUint16();
    const identifier = readString(idLen);
    const resourceType = readString(16);
    readInt32(); // unknown
    if (version >= 4) readUint16(); // unknown2
    const fragCount = readByte();
    const fragments: ErpFragment[] = [];
    for (let j = 0; j < fragCount; j++) {
      const name = readString(4);
      const offset = readUint64();
      const size = readUint64();
      const flags = readInt32();
      let compression = 0, packedSize = 0n;
      if (version > 2) {
        compression = readByte();
        packedSize = readUint64();
      }
      fragments.push({ name, offset, size, flags, compression, packedSize });
    }
    if (version > 2) skip(16); // hash
    resources.push({ identifier, resourceType, fragments });
  }

  return { header: { magic, version, resourceOffset, numFiles, numTempFiles }, resources };
}

async function decompressFragment(
  buffer: Buffer,
  resourceOffset: bigint,
  fragment: ErpFragment
): Promise<Buffer> {
  const dataOffset = Number(resourceOffset) + Number(fragment.offset);
  const dataSize = Number(fragment.packedSize || fragment.size);
  const compressed = buffer.subarray(dataOffset, dataOffset + dataSize);

  // Compression byte 0x91 (145) = None/uncompressed
  if (fragment.compression === 0x91 || fragment.compression === 0 || fragment.compression === 1 || fragment.compression === 6 || fragment.compression === 7) {
    return Buffer.from(compressed);
  }

  // Compression byte 0x11 (17) = ZStandard
  if (fragment.compression === 0x11 || fragment.compression === 3 || fragment.compression === 4 || fragment.compression === 5) {
    const decompressed = fzstd.decompress(new Uint8Array(compressed));
    return Buffer.from(decompressed);
  }

  if (fragment.compression === 2) {
    const zlib = await import('zlib');
    try {
      return Buffer.from(zlib.inflateSync(compressed));
    } catch {
      return Buffer.from(zlib.inflateRawSync(compressed));
    }
  }

  console.log(`    [Unknown compression: ${fragment.compression}, returning raw]`);
  return Buffer.from(compressed);
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  if (!filePath) {
    console.error('Usage: bun run scripts/erp-extract.ts <file.erp> <pattern> [--output <dir>] [--peek] [--hex]');
    process.exit(1);
  }

  const buffer = Buffer.from(readFileSync(filePath));
  const erp = readErpFile(buffer);

  const pattern = args[1] || '';
  const outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const peek = args.includes('--peek');
  const hex = args.includes('--hex');

  if (pattern === '--list-types') {
    const types = new Set(erp.resources.map(r => r.resourceType));
    console.log('Resource types:', [...types].sort().join(', '));
    return;
  }

  // Filter resources
  const matching = erp.resources.filter(r =>
    r.identifier.toLowerCase().includes(pattern.toLowerCase()) ||
    r.resourceType.toLowerCase().includes(pattern.toLowerCase())
  );

  console.log(`Found ${matching.length} matching resources (of ${erp.resources.length} total)`);

  for (const res of matching) {
    console.log(`\n=== ${res.identifier} ===`);
    console.log(`  Type: ${res.resourceType}  Fragments: ${res.fragments.length}`);

    for (let fi = 0; fi < res.fragments.length; fi++) {
      const frag = res.fragments[fi];
      console.log(`  Fragment [${frag.name}]: size=${frag.size} packed=${frag.packedSize} compression=0x${frag.compression.toString(16)}`);

      const data = await decompressFragment(buffer, erp.header.resourceOffset, frag);
      console.log(`    Decompressed: ${data.length} bytes`);

      if (peek || hex) {
        const showLen = hex ? Math.min(512, data.length) : Math.min(128, data.length);
        for (let i = 0; i < showLen; i += 16) {
          const row = data.subarray(i, Math.min(i + 16, showLen));
          const hexStr = Array.from(row).map(b => b.toString(16).padStart(2, '0')).join(' ');
          const ascStr = Array.from(row).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
          console.log(`    ${i.toString(16).padStart(8, '0')}  ${hexStr.padEnd(48)}  ${ascStr}`);
        }
        if (data.length > showLen) {
          console.log(`    ... (${data.length - showLen} more bytes)`);
        }
      }

      if (outputDir) {
        mkdirSync(outputDir, { recursive: true });
        const safeName = res.identifier
          .replace(/^eaid:\/\//, '')
          .replace(/[?&=]/g, '_')
          .replace(/\//g, '__');
        const outFile = join(outputDir, `${safeName}.frag${fi}.bin`);
        writeFileSync(outFile, data);
        console.log(`    Written to: ${outFile}`);
      }
    }
  }
}

main().catch(console.error);
