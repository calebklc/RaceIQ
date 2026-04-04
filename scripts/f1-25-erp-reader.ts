/**
 * ERP File Reader for EGO Engine archives (F1 25, etc.)
 * Based on reverse-engineered format from EgoEngineModding/Ego-Engine-Modding
 *
 * ERP Format (Version 4):
 * ─────────────────────────
 * Header (48 bytes):
 *   0x00  uint32  magic          (0x4B534845 = "ESHK" LE)
 *   0x04  int32   version        (expected: 4)
 *   0x08  8 bytes padding
 *   0x10  8 bytes infoOffset     (typically 48)
 *   0x18  8 bytes infoSize
 *   0x20  uint64  resourceOffset (byte offset to resource data blobs)
 *   0x28  8 bytes padding
 *   0x30  int32   numFiles       (number of resource entries)
 *   0x34  int32   numTempFiles   (number of fragments total)
 *
 * Then numFiles resource entries, each:
 *   uint32  entryInfoLength
 *   uint16  identifierLength
 *   string  identifier (identifierLength bytes, null-terminated)
 *   string  resourceType (16 bytes, null-padded)
 *   int32   unknown
 *   uint16  unknown2        (version >= 4 only)
 *   byte    fragmentCount
 *   Fragment[fragmentCount]:
 *     string  name (4 bytes)
 *     uint64  offset
 *     uint64  size (uncompressed)
 *     int32   flags
 *     byte    compression   (version > 2 only)
 *     uint64  packedSize    (version > 2 only)
 *   byte[16] hash           (version > 2 only)
 */

const ERP_MAGIC = 0x4b505245; // "ERPK" in little-endian

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
  unknown: number;
  unknown2: number;
  fragmentCount: number;
  fragments: ErpFragment[];
  hash: Uint8Array;
}

interface ErpFile {
  header: ErpHeader;
  resources: ErpResource[];
}

function readErpFile(buffer: Buffer): ErpFile {
  let pos = 0;

  function readUint32(): number {
    const val = buffer.readUInt32LE(pos);
    pos += 4;
    return val;
  }

  function readInt32(): number {
    const val = buffer.readInt32LE(pos);
    pos += 4;
    return val;
  }

  function readUint16(): number {
    const val = buffer.readUInt16LE(pos);
    pos += 2;
    return val;
  }

  function readByte(): number {
    const val = buffer[pos];
    pos += 1;
    return val;
  }

  function readUint64(): bigint {
    const val = buffer.readBigUInt64LE(pos);
    pos += 8;
    return val;
  }

  function readBytes(n: number): Buffer {
    const val = buffer.subarray(pos, pos + n);
    pos += n;
    return val;
  }

  function readString(n: number): string {
    const bytes = buffer.subarray(pos, pos + n);
    pos += n;
    // Trim null bytes
    let end = bytes.indexOf(0);
    if (end === -1) end = n;
    return bytes.subarray(0, end).toString('utf-8');
  }

  // Read header
  const magic = readUint32();
  if (magic !== ERP_MAGIC) {
    throw new Error(`Invalid ERP magic: 0x${magic.toString(16)} (expected 0x${ERP_MAGIC.toString(16)})`);
  }

  const version = readInt32();
  if (version < 0 || version > 4) {
    throw new Error(`Unsupported ERP version: ${version}`);
  }

  readBytes(8); // padding
  readBytes(8); // infoOffset
  readBytes(8); // infoSize
  const resourceOffset = readUint64();
  readBytes(8); // padding
  const numFiles = readInt32();
  const numTempFiles = readInt32();

  const header: ErpHeader = {
    magic,
    version,
    resourceOffset,
    numFiles,
    numTempFiles,
  };

  console.log(`ERP Header:`);
  console.log(`  Magic: 0x${magic.toString(16)}`);
  console.log(`  Version: ${version}`);
  console.log(`  Resource Offset: ${resourceOffset}`);
  console.log(`  Num Files: ${numFiles}`);
  console.log(`  Num Fragments: ${numTempFiles}`);
  console.log(`  Header ended at offset: 0x${pos.toString(16)}`);
  console.log();

  // Read resources
  const resources: ErpResource[] = [];
  for (let i = 0; i < numFiles; i++) {
    const entryInfoLength = readUint32();
    const identifierLength = readUint16();
    const identifier = readString(identifierLength);
    const resourceType = readString(16);
    const unknown = readInt32();
    let unknown2 = 0;
    if (version >= 4) {
      unknown2 = readUint16();
    }
    const fragmentCount = readByte();

    const fragments: ErpFragment[] = [];
    for (let j = 0; j < fragmentCount; j++) {
      const name = readString(4);
      const offset = readUint64();
      const size = readUint64();
      const flags = readInt32();
      let compression = 0;
      let packedSize = 0n;
      if (version > 2) {
        compression = readByte();
        packedSize = readUint64();
      }
      fragments.push({ name, offset, size, flags, compression, packedSize });
    }

    let hash = new Uint8Array(0);
    if (version > 2) {
      hash = new Uint8Array(readBytes(16));
    }

    resources.push({
      identifier,
      resourceType,
      unknown,
      unknown2,
      fragmentCount,
      fragments,
      hash,
    });
  }

  return { header, resources };
}

function compressionName(c: number): string {
  const names: Record<number, string> = {
    0: 'None',
    1: 'None2',
    2: 'Zlib',
    3: 'ZStandard',
    4: 'ZStandard2',
    5: 'ZStandard3',
    6: 'None3',
    7: 'None4',
  };
  return names[c] ?? `Unknown(${c})`;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: bun run scripts/erp-reader.ts <file.erp>');
    process.exit(1);
  }

  const file = Bun.file(filePath);
  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  console.log(`File: ${filePath}`);
  console.log(`Size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log();

  const erp = readErpFile(buffer);

  console.log(`=== Resources (${erp.resources.length}) ===`);
  for (const res of erp.resources) {
    const totalSize = res.fragments.reduce((s, f) => s + f.size, 0n);
    const totalPacked = res.fragments.reduce((s, f) => s + f.packedSize, 0n);
    console.log(`  ${res.identifier}`);
    console.log(`    Type: ${res.resourceType}  Fragments: ${res.fragmentCount}  Size: ${totalSize} / Packed: ${totalPacked}`);
    for (const frag of res.fragments) {
      console.log(`      [${frag.name}] offset=${frag.offset} size=${frag.size} packed=${frag.packedSize} compression=${compressionName(frag.compression)} flags=0x${frag.flags.toString(16)}`);
    }
  }

  // Also dump first 64 bytes of each fragment for the first few resources to help identify data
  if (process.argv[3] === '--peek') {
    const peekCount = parseInt(process.argv[4] || '5');
    console.log(`\n=== Peeking at first ${peekCount} resources ===`);
    for (let i = 0; i < Math.min(peekCount, erp.resources.length); i++) {
      const res = erp.resources[i];
      console.log(`\n--- ${res.identifier} (${res.resourceType}) ---`);
      for (const frag of res.fragments) {
        const dataOffset = Number(erp.header.resourceOffset) + Number(frag.offset);
        const peekLen = Math.min(64, Number(frag.packedSize || frag.size));
        const peek = buffer.subarray(dataOffset, dataOffset + peekLen);
        const hex = Array.from(peek).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = Array.from(peek).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
        console.log(`  Fragment [${frag.name}] @ 0x${dataOffset.toString(16)}:`);
        console.log(`    HEX: ${hex}`);
        console.log(`    ASC: ${ascii}`);
      }
    }
  }
}

main().catch(console.error);
