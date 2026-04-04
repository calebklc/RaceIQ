/**
 * Forza LZX Decompressor
 *
 * Decompresses LZX-compressed data from Forza Motorsport ZIP files
 * (non-standard ZIP compression method 21).
 *
 * Ported from xnbcli by James Stine (Ms-PL), derived from MonoGame's
 * LzxDecoder by Ali Scissons (LGPL 2.1), itself from libmspack by Stuart Caie.
 *
 * Original LZX implementation:
 *   Copyright (C) Stuart Caie <kyzer@cabextract.org.uk>
 *   Licensed under LGPL 2.1
 *
 * MonoGame adaptation:
 *   Copyright (C) The MonoGame Team
 *   Licensed under Microsoft Public License (Ms-PL)
 */

import { readFileSync, existsSync } from "fs";

// ─── Constants ───────────────────────────────────────────────────────

const MIN_MATCH = 2;
const NUM_CHARS = 256;
const NUM_PRIMARY_LENGTHS = 7;
const NUM_SECONDARY_LENGTHS = 249;

const BLOCKTYPE_VERBATIM = 1;
const BLOCKTYPE_ALIGNED = 2;
const BLOCKTYPE_UNCOMPRESSED = 3;

const PRETREE_NUM_ELEMENTS = 20;
const PRETREE_MAXBITS = 6;
const MAINTREE_MAXBITS = 12;
const LENGTH_MAXBITS = 12;
const ALIGNED_NUM_ELEMENTS = 8;
const ALIGNED_MAXBITS = 7;

// Precompute position_base and extra_bits tables (up to index 51)
const extra_bits: number[] = [];
const position_base: number[] = [];

{
  let j = 0;
  for (let i = 0; i <= 50; i += 2) {
    extra_bits[i] = j;
    extra_bits[i + 1] = j;
    if (i !== 0 && j < 17) j++;
  }
}
{
  let j = 0;
  for (let i = 0; i <= 50; i++) {
    position_base[i] = j;
    j += 1 << extra_bits[i];
  }
}

// ─── Types ───────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  compSize: number;
  uncompSize: number;
  dataStart: number;
}

// ─── BitReader ───────────────────────────────────────────────────────
// Reads from 16-bit LE words, MSB-first within each word.

class BitReader {
  private _buf: Buffer;
  _offset: number; // byte offset into buffer
  _bitOffset: number; // bit offset within current 16-bit word (0-15)

  constructor(buf: Buffer) {
    this._buf = buf;
    this._offset = 0;
    this._bitOffset = 0;
  }

  /** Peek at bytes from current offset without advancing */
  private peek(n: number): Buffer {
    const end = Math.min(this._offset + n, this._buf.length);
    if (end - this._offset < n) {
      const r = Buffer.alloc(n, 0);
      this._buf.copy(r, 0, this._offset, end);
      return r;
    }
    return this._buf.subarray(this._offset, this._offset + n);
  }

  readLZXBits(bits: number): number {
    if (bits === 0) return 0;
    let bitsLeft = bits;
    let read = 0;

    while (bitsLeft > 0) {
      const peek = this.peek(2).readUInt16LE(0);
      const bitsInFrame = Math.min(bitsLeft, 16 - this._bitOffset);
      const offset = 16 - this._bitOffset - bitsInFrame;
      const value =
        (peek & (((1 << bitsInFrame) - 1) << offset)) >>> offset;
      bitsLeft -= bitsInFrame;
      this._bitOffset += bitsInFrame;
      if (this._bitOffset >= 16) {
        this._bitOffset -= 16;
        this._offset += 2;
      }
      read |= value << bitsLeft;
    }

    return read >>> 0;
  }

  peekLZXBits(bits: number): number {
    if (bits === 0) return 0;
    // Save state
    const savedOffset = this._offset;
    const savedBitOffset = this._bitOffset;
    const result = this.readLZXBits(bits);
    // Restore state
    this._offset = savedOffset;
    this._bitOffset = savedBitOffset;
    return result;
  }

  readInt32(): number {
    const v = this._buf.readInt32LE(this._offset);
    this._offset += 4;
    return v;
  }

  align(): void {
    if (this._bitOffset > 0) {
      this.bitPosition += 16 - this._bitOffset;
    }
  }

  get bitPosition(): number {
    return this._bitOffset;
  }

  set bitPosition(offset: number) {
    if (offset < 0) offset = 16 - offset;
    this._bitOffset = offset % 16;
    this._offset +=
      Math.floor((offset - (Math.abs(offset) % 16)) / 16) * 2;
  }
}

// ─── Huffman table builder ───────────────────────────────────────────
// Two-phase: direct entries for codes <= bits, tree nodes for longer codes.
// Fill unused with 0xFFFF sentinel.

function decodeTable(
  nsyms: number,
  nbits: number,
  lengths: number[]
): number[] {
  const table: number[] = [];
  let pos = 0;
  const tableMask = 1 << nbits;
  let bitMask = tableMask >> 1;

  // Phase 1: direct entries for codes up to nbits
  for (let bitCount = 1; bitCount <= nbits; bitCount++) {
    for (let sym = 0; sym < nsyms; sym++) {
      if (lengths[sym] !== bitCount) continue;
      let leaf = pos;
      if ((pos += bitMask) > tableMask)
        throw new Error("Huffman table overrun!");
      let fill = bitMask;
      while (fill--) table[leaf++] = sym;
    }
    bitMask >>= 1;
  }

  // If table is full, return
  if (pos === tableMask) return table;

  // Fill remaining direct entries with sentinel
  for (let sym = pos; sym < tableMask; sym++) table[sym] = 0xffff;

  // Phase 2: tree nodes for codes longer than nbits
  let nextSym =
    (tableMask >> 1) < nsyms ? nsyms : tableMask >> 1;
  pos <<= 16;
  const tableMask16 = tableMask << 16;
  bitMask = 1 << 15;

  for (let bitCount = nbits + 1; bitCount <= 16; bitCount++) {
    for (let sym = 0; sym < nsyms; sym++) {
      if (lengths[sym] !== bitCount) continue;

      let leaf = pos >> 16;
      for (let fill = 0; fill < bitCount - nbits; fill++) {
        if (table[leaf] === 0xffff) {
          table[nextSym << 1] = 0xffff;
          table[(nextSym << 1) + 1] = 0xffff;
          table[leaf] = nextSym++;
        }
        leaf = table[leaf] << 1;
        if ((pos >>> (15 - fill)) & 1) leaf++;
      }
      table[leaf] = sym;

      if ((pos += bitMask) > tableMask16)
        throw new Error("Huffman table overrun!");
    }
    bitMask >>= 1;
  }

  return table;
}

// Read a Huffman symbol from the bitstream using the decode table.
// Peeks bits, looks up in table; if symbol >= nsyms (tree node), walks tree.
// Advances bitPosition by the symbol's actual code length.
function readHuffSymbol(
  reader: BitReader,
  table: number[],
  lengths: number[],
  nsyms: number,
  nbits: number
): number {
  const peeked32 = reader.peekLZXBits(32) >>> 0;
  let sym = table[reader.peekLZXBits(nbits)];

  if (sym >= nsyms) {
    // Tree walk for codes longer than nbits
    let j = 1 << (32 - nbits);
    do {
      j >>= 1;
      sym <<= 1;
      sym |= peeked32 & j ? 1 : 0;
      if (!j) return 0;
    } while ((sym = table[sym]) >= nsyms);
  }

  reader.bitPosition += lengths[sym];
  return sym;
}

// ─── LzxDecoder ──────────────────────────────────────────────────────

class LzxDecoder {
  private windowSize: number;
  private win: number[];
  private windowPosn: number;

  private R0: number;
  private R1: number;
  private R2: number;

  private mainElements: number;

  headerRead: boolean;
  private blockRemaining: number;
  private blockType: number;

  // Intel E8 call translation state
  private intelStarted: boolean;
  private intelFileSize: number;
  private intelCurPos: number;

  private maintreeLen: number[];
  private maintreeTable: number[];
  private lengthLen: number[];
  private lengthTable: number[];
  private alignedLen: number[];
  private alignedTable: number[];
  private pretreeLen: number[];
  private pretreeTable: number[];

  constructor(windowBits: number) {
    if (windowBits < 15 || windowBits > 21) {
      throw new Error(`Invalid window bits: ${windowBits}`);
    }

    this.windowSize = 1 << windowBits;
    this.win = new Array(this.windowSize).fill(0);
    this.windowPosn = 0;

    this.R0 = 1;
    this.R1 = 1;
    this.R2 = 1;

    const posnSlots =
      windowBits === 21 ? 50 : windowBits === 20 ? 42 : windowBits << 1;
    this.mainElements = NUM_CHARS + (posnSlots << 3);

    this.headerRead = false;
    this.blockRemaining = 0;
    this.blockType = 0;

    this.intelStarted = false;
    this.intelFileSize = 0;
    this.intelCurPos = 0;

    // Initialize length arrays
    this.maintreeLen = new Array(NUM_CHARS + 50 * 8).fill(0);
    this.lengthLen = new Array(NUM_SECONDARY_LENGTHS).fill(0);
    this.alignedLen = [];
    this.pretreeLen = [];

    this.maintreeTable = [];
    this.lengthTable = [];
    this.alignedTable = [];
    this.pretreeTable = [];
  }

  /** Reset full decoder state between frames (R0/R1/R2, block state, trees) */
  resetState(): void {
    this.R0 = 1;
    this.R1 = 1;
    this.R2 = 1;
    this.blockRemaining = 0;
    this.blockType = 0;
    this.maintreeLen.fill(0);
    this.lengthLen.fill(0);
    this.alignedLen = [];
    this.alignedTable = [];
    this.maintreeTable = [];
    this.lengthTable = [];
    this.pretreeLen = [];
    this.pretreeTable = [];
  }

  /** Reset only block-level state so new LZX block headers are read from fresh bitstream.
   *  Preserves window, R0/R1/R2, and Huffman trees. */
  resetBlockState(): void {
    this.blockRemaining = 0;
    this.blockType = 0;
  }

  decompress(reader: BitReader, frameSize: number): number[] {
    // Read intel header on first call
    if (!this.headerRead) {
      const intel = reader.readLZXBits(1);
      if (intel) {
        const hi = reader.readLZXBits(16);
        const lo = reader.readLZXBits(16);
        this.intelFileSize = (hi << 16) | lo;
        this.intelStarted = true;
      }
      this.headerRead = true;
    }

    let togo = frameSize;

    while (togo > 0) {
      if (this.blockRemaining === 0) {
        // Read block header
        this.blockType = reader.readLZXBits(3);
        const hi = reader.readLZXBits(16);
        const lo = reader.readLZXBits(8);
        this.blockRemaining = (hi << 8) | lo;

        switch (this.blockType) {
          // @ts-ignore — intentional fallthrough: ALIGNED initialises extra table then shares VERBATIM logic
          case BLOCKTYPE_ALIGNED:
            // Read 8 aligned lengths (3 bits each), build table, then fall through to VERBATIM
            for (let i = 0; i < ALIGNED_NUM_ELEMENTS; i++) {
              this.alignedLen[i] = reader.readLZXBits(3);
            }
            this.alignedTable = decodeTable(
              ALIGNED_NUM_ELEMENTS,
              ALIGNED_MAXBITS,
              this.alignedLen
            );
            // falls through
          case BLOCKTYPE_VERBATIM:
            this.readLengths(reader, this.maintreeLen, 0, NUM_CHARS);
            this.readLengths(
              reader,
              this.maintreeLen,
              NUM_CHARS,
              this.mainElements
            );
            this.maintreeTable = decodeTable(
              NUM_CHARS + 50 * 8,
              MAINTREE_MAXBITS,
              this.maintreeLen
            );
            this.readLengths(
              reader,
              this.lengthLen,
              0,
              NUM_SECONDARY_LENGTHS
            );
            this.lengthTable = decodeTable(
              NUM_SECONDARY_LENGTHS + 1,
              LENGTH_MAXBITS,
              this.lengthLen
            );
            break;

          case BLOCKTYPE_UNCOMPRESSED:
            reader.align();
            this.R0 = reader.readInt32();
            this.R1 = reader.readInt32();
            this.R2 = reader.readInt32();
            break;

          default:
            throw new Error(`Invalid block type: ${this.blockType}`);
        }
      }

      let thisRun: number;
      while ((thisRun = this.blockRemaining) > 0 && togo > 0) {
        if (thisRun > togo) thisRun = togo;
        togo -= thisRun;
        this.blockRemaining -= thisRun;
        this.windowPosn &= this.windowSize - 1;

        if (
          this.blockType === BLOCKTYPE_VERBATIM ||
          this.blockType === BLOCKTYPE_ALIGNED
        ) {
          this.decodeBlock(
            reader,
            thisRun,
            this.blockType === BLOCKTYPE_ALIGNED
          );
        } else if (this.blockType === BLOCKTYPE_UNCOMPRESSED) {
          for (let i = 0; i < thisRun; i++) {
            this.win[
              (this.windowPosn + i) & (this.windowSize - 1)
            ] = reader.readLZXBits(8);
          }
          this.windowPosn += thisRun;
        }
      }
    }

    // Extract output from circular window
    const mask = this.windowSize - 1;
    const wp = this.windowPosn & mask;
    const start =
      (wp === 0 ? this.windowSize : wp) - frameSize;
    const result: number[] = [];
    for (let i = 0; i < frameSize; i++) {
      result.push(
        this.win[(start + this.windowSize + i) & mask]
      );
    }

    // Intel E8 call translation: convert absolute x86 CALL targets back to relative
    if (this.intelStarted && this.intelCurPos < this.intelFileSize) {
      const curPos = this.intelCurPos;
      const fileSize = this.intelFileSize;
      if (frameSize >= 10) {
        for (let i = 0; i < frameSize - 10; i++) {
          if (result[i] !== 0xe8) continue;
          const absTarget =
            result[i + 1] |
            (result[i + 2] << 8) |
            (result[i + 3] << 16) |
            (result[i + 4] << 24);
          const pos = curPos + i;
          if (absTarget >= -pos && absTarget < fileSize) {
            let relTarget: number;
            if (absTarget >= 0) {
              relTarget = absTarget - pos;
            } else {
              relTarget = absTarget + fileSize;
            }
            result[i + 1] = relTarget & 0xff;
            result[i + 2] = (relTarget >>> 8) & 0xff;
            result[i + 3] = (relTarget >>> 16) & 0xff;
            result[i + 4] = (relTarget >>> 24) & 0xff;
          }
          i += 4;
        }
      }
      this.intelCurPos += frameSize;
    }

    return result;
  }

  private decodeBlock(
    reader: BitReader,
    run: number,
    aligned: boolean
  ): void {
    const ws = this.windowSize;
    const wm = ws - 1;

    while (run > 0) {
      let me = readHuffSymbol(
        reader,
        this.maintreeTable,
        this.maintreeLen,
        NUM_CHARS + 50 * 8,
        MAINTREE_MAXBITS
      );

      if (me < NUM_CHARS) {
        // Literal byte
        this.win[this.windowPosn++ & wm] = me;
        run--;
        continue;
      }

      // Match
      me -= NUM_CHARS;
      let matchLength = me & NUM_PRIMARY_LENGTHS;
      if (matchLength === NUM_PRIMARY_LENGTHS) {
        matchLength += readHuffSymbol(
          reader,
          this.lengthTable,
          this.lengthLen,
          NUM_SECONDARY_LENGTHS + 1,
          LENGTH_MAXBITS
        );
      }
      matchLength += MIN_MATCH;

      let matchOffset = me >> 3;

      if (matchOffset > 2) {
        if (aligned) {
          // ALIGNED block: use aligned tree for low 3 bits
          let eb = extra_bits[matchOffset];
          matchOffset = position_base[matchOffset] - 2;
          if (eb > 3) {
            eb -= 3;
            matchOffset += reader.readLZXBits(eb) << 3;
            matchOffset += readHuffSymbol(
              reader,
              this.alignedTable,
              this.alignedLen,
              ALIGNED_NUM_ELEMENTS,
              ALIGNED_MAXBITS
            );
          } else if (eb === 3) {
            matchOffset += readHuffSymbol(
              reader,
              this.alignedTable,
              this.alignedLen,
              ALIGNED_NUM_ELEMENTS,
              ALIGNED_MAXBITS
            );
          } else if (eb > 0) {
            matchOffset += reader.readLZXBits(eb);
          } else {
            matchOffset = 1;
          }
        } else {
          // VERBATIM block
          if (matchOffset !== 3) {
            matchOffset =
              position_base[matchOffset] -
              2 +
              reader.readLZXBits(extra_bits[matchOffset]);
          } else {
            matchOffset = 1;
          }
        }
        this.R2 = this.R1;
        this.R1 = this.R0;
        this.R0 = matchOffset;
      } else if (matchOffset === 0) {
        matchOffset = this.R0;
      } else if (matchOffset === 1) {
        matchOffset = this.R1;
        this.R1 = this.R0;
        this.R0 = matchOffset;
      } else {
        matchOffset = this.R2;
        this.R2 = this.R0;
        this.R0 = matchOffset;
      }

      // Copy match from window
      let rd = this.windowPosn;
      let rs: number;
      run -= matchLength;

      if (this.windowPosn >= matchOffset) {
        rs = rd - matchOffset;
      } else {
        rs = rd + (ws - matchOffset);
        let copyLen = matchOffset - this.windowPosn;
        if (copyLen < matchLength) {
          matchLength -= copyLen;
          this.windowPosn += copyLen;
          while (copyLen-- > 0) {
            this.win[rd++ & wm] = this.win[rs++ & wm];
          }
          rs = 0;
        }
      }

      this.windowPosn += matchLength;
      while (matchLength-- > 0) {
        this.win[rd++ & wm] = this.win[rs++ & wm];
      }
    }
  }

  private readLengths(
    reader: BitReader,
    table: number[],
    first: number,
    last: number
  ): void {
    // Read pretree (20 symbols, 4 bits each)
    for (let i = 0; i < PRETREE_NUM_ELEMENTS; i++) {
      this.pretreeLen[i] = reader.readLZXBits(4);
    }
    this.pretreeTable = decodeTable(
      PRETREE_NUM_ELEMENTS,
      PRETREE_MAXBITS,
      this.pretreeLen
    );

    for (let i = first; i < last; ) {
      let sym = readHuffSymbol(
        reader,
        this.pretreeTable,
        this.pretreeLen,
        PRETREE_NUM_ELEMENTS,
        PRETREE_MAXBITS
      );

      if (sym === 17) {
        // Run of zeros: 4 + readBits(4)
        let zeros = reader.readLZXBits(4) + 4;
        while (zeros--) table[i++] = 0;
      } else if (sym === 18) {
        // Long run of zeros: 20 + readBits(5)
        let zeros = reader.readLZXBits(5) + 20;
        while (zeros--) table[i++] = 0;
      } else if (sym === 19) {
        // Run of same value: 4 + readBits(1) repetitions
        let same = reader.readLZXBits(1) + 4;
        sym = readHuffSymbol(
          reader,
          this.pretreeTable,
          this.pretreeLen,
          PRETREE_NUM_ELEMENTS,
          PRETREE_MAXBITS
        );
        sym = table[i] - sym;
        if (sym < 0) sym += 17;
        while (same--) table[i++] = sym;
      } else {
        // Delta
        sym = table[i] - sym;
        if (sym < 0) sym += 17;
        table[i++] = sym;
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────


export function decompressForzaLZX(
  compressed: Buffer,
  expectedSize: number,
): Buffer {
  let dataStart = 0;

  // Detect FF header for small files
  if (compressed[0] === 0xff) {
    const embeddedSize = compressed.readUInt16BE(1);
    if (embeddedSize === expectedSize) dataStart = 4;
  }

  const payload = compressed.subarray(dataStart);

  // Try multiple approaches — the format varies between files
  for (const wb of [16, 17, 15]) {
    // Approach 0a: XMem 2-byte header blocks with concatenated stream
    // Strips block headers, uses single reader with chunk-boundary alignment.
    try {
      const result = decompressXMem2ByteHeadersConcatenated(payload, expectedSize, wb);
      if (result.length === expectedSize) return result;
    } catch {}

    // Approach 0b: XMem 2-byte header blocks with persistent decoder
    // (delta-encoded Huffman tables shared across blocks)
    try {
      const result = decompressXMem2ByteHeaders(payload, expectedSize, wb);
      if (result.length >= expectedSize * 0.5) return result;
    } catch {}

    // Approach 1a: XMem block framing with independent decoders
    try {
      const result = decompressXMemBlocks(payload, expectedSize, wb, false);
      if (result.length === expectedSize) return result;
    } catch {}

    // Approach 1b: XMem block framing with persistent decoder state
    try {
      const result = decompressXMemBlocks(payload, expectedSize, wb, true);
      if (result.length === expectedSize) return result;
    } catch {}

    // Approach 2: Single LZX stream
    try {
      const reader = new BitReader(payload);
      const decoder = new LzxDecoder(wb);
      const result = decoder.decompress(reader, expectedSize);
      return Buffer.from(result);
    } catch {}

    // Approach 3: Skip different header sizes
    for (const skip of [2, 3, 5, 6, 8]) {
      if (skip >= compressed.length) continue;
      try {
        const reader = new BitReader(compressed.subarray(skip));
        const decoder = new LzxDecoder(wb);
        const result = decoder.decompress(reader, expectedSize);
        return Buffer.from(result);
      } catch {}
    }
  }

  // Approach 4: XMem with skip + persistent decoder
  for (const skip of [2, 4]) {
    for (const wb of [17, 16, 15]) {
      try {
        const result = decompressXMemBlocks(
          compressed.subarray(skip), expectedSize, wb, true,
        );
        if (result.length === expectedSize) return result;
      } catch {}
    }
  }

  // Last resort: multi-frame for large files - try many combinations
  // of skip bytes, window bits, and frame sizes, keeping the best result
  let bestResult: Buffer | null = null;
  let bestLen = 0;

  for (const skip of [0, 2, 4, 6]) {
    if (skip >= compressed.length) continue;
    for (const wb of [15, 16, 17, 18]) {
      for (const frameSz of [0x8000, 0x4000, 0x2000]) {
        const stream = compressed.subarray(skip);
        const reader = new BitReader(stream);
        let decoder: LzxDecoder;
        try {
          decoder = new LzxDecoder(wb);
        } catch {
          continue;
        }
        const output = Buffer.alloc(expectedSize);
        let pos = 0;
        let remaining = expectedSize;
        while (remaining > 0) {
          const thisFrame = Math.min(frameSz, remaining);
          try {
            const frame = decoder.decompress(reader, thisFrame);
            for (let i = 0; i < frame.length; i++) output[pos + i] = frame[i];
            pos += thisFrame;
            remaining -= thisFrame;
          } catch {
            break;
          }
        }
        if (pos > bestLen) {
          bestLen = pos;
          bestResult = output.subarray(0, pos);
        }
        if (pos === expectedSize) return bestResult!;
      }
    }
  }

  if (bestResult && bestLen >= expectedSize * 0.1) return bestResult;

  throw new Error(
    `LZX decompression failed for ${compressed.length} bytes → ${expectedSize} expected`,
  );
}

function decompressXMemBlocks(
  data: Buffer,
  expectedSize: number,
  windowBits: number,
  persistDecoder = false,
): Buffer {
  const output = Buffer.alloc(expectedSize);
  let outPos = 0;
  let offset = 0;
  const sharedDecoder = persistDecoder ? new LzxDecoder(windowBits) : null;
  while (offset < data.length - 4 && outPos < expectedSize) {
    const compBlockSize = data.readUInt16BE(offset);
    const uncompBlockSize = data.readUInt16BE(offset + 2);
    offset += 4;
    if (compBlockSize === 0 || uncompBlockSize === 0) break;
    if (offset + compBlockSize > data.length) break;
    const blockData = data.subarray(offset, offset + compBlockSize);
    const reader = new BitReader(blockData);
    const decoder = sharedDecoder ?? new LzxDecoder(windowBits);
    const result = decoder.decompress(reader, uncompBlockSize);
    for (let i = 0; i < result.length && outPos < expectedSize; i++)
      output[outPos++] = result[i];
    offset += compBlockSize;
  }
  return output.subarray(0, outPos);
}

/**
 * Validates that data uses 2-byte header block framing:
 * - Blocks consume nearly all input (>= 95%)
 * - Expected output (blockCount * 32KB) is close to expectedSize (within 5%)
 * - All blocks are reasonably sized (>= 256 bytes)
 * - Supports 0xFF last-block marker: FF [uncompSize:2 BE] [compSize:2 BE]
 */
// @ts-ignore — utility function reserved for future validation
function _isValid2ByteHeaderFraming(data: Buffer, expectedSize: number): boolean {
  const BLOCK_OUTPUT = 0x8000;
  let scanOffset = 0;
  let blockCount = 0;
  let minBlockSize = Infinity;
  let totalOutput = 0;
  while (scanOffset < data.length) {
    if (data[scanOffset] === 0xff && scanOffset + 5 <= data.length) {
      // Last block marker: FF [uncompSize:2 BE] [compSize:2 BE]
      const lastUncomp = data.readUInt16BE(scanOffset + 1);
      const lastComp = data.readUInt16BE(scanOffset + 3);
      scanOffset += 5;
      if (scanOffset + lastComp > data.length) break;
      scanOffset += lastComp;
      totalOutput += lastUncomp;
      blockCount++;
      break;
    }
    if (scanOffset + 2 > data.length) break;
    const sz = data.readUInt16BE(scanOffset);
    scanOffset += 2;
    if (sz === 0) break;
    if (scanOffset + sz > data.length) break;
    if (sz < minBlockSize) minBlockSize = sz;
    scanOffset += sz;
    totalOutput += BLOCK_OUTPUT;
    blockCount++;
  }
  if (blockCount < 2 || minBlockSize < 256) return false;
  if (scanOffset < data.length * 0.95) return false;
  const ratio = expectedSize / totalOutput;
  return ratio >= 0.95 && ratio <= 1.05;
}

/**
 * XMem LZX decompression with 2-byte block headers.
 * Format: [2B BE compressed_block_size] [LZX data] repeated.
 * Last block uses 0xFF marker: FF [uncompSize:2 BE] [compSize:2 BE].
 * Each block decompresses to 32KB (0x8000) except the last which is smaller.
 *
 * Key insight: blocks share decoder state (delta-encoded Huffman tables,
 * R0/R1/R2 repeat offsets, sliding window). A single persistent LzxDecoder
 * is reused across all blocks, with a fresh padded BitReader per block.
 * Intel header is only read for block 0.
 */
function decompressXMem2ByteHeaders(
  data: Buffer,
  expectedSize: number,
  windowBits: number,
): Buffer {
  const BLOCK_OUTPUT = 0x8000; // 32KB per block
  const FRAME_SIZE = 0x1000;   // 4KB sub-frames for last-block recovery
  const PADDING = 16;           // Zero-byte padding for BitReader peek-ahead
  const output = Buffer.alloc(expectedSize);
  let outPos = 0;
  let offset = 0;
  const decoder = new LzxDecoder(windowBits);
  let blockIndex = 0;
  while (offset < data.length - 1 && outPos < expectedSize) {
    let compBlockSize: number;
    let uncompBlockSize: number;

    // Check for 0xFF last-block marker: FF [uncompSize:2 BE] [compSize:2 BE]
    if (data[offset] === 0xff && offset + 5 <= data.length) {
      uncompBlockSize = data.readUInt16BE(offset + 1);
      compBlockSize = data.readUInt16BE(offset + 3);
      offset += 5;
    } else {
      compBlockSize = data.readUInt16BE(offset);
      offset += 2;
      const remaining = expectedSize - outPos;
      uncompBlockSize = Math.min(BLOCK_OUTPUT, remaining);
    }

    if (compBlockSize === 0) break;
    const actualCompSize = Math.min(compBlockSize, data.length - offset);
    if (actualCompSize <= 0) break;
    // Pad block data with zeros so BitReader peek-ahead doesn't read garbage
    const padded = Buffer.alloc(actualCompSize + PADDING, 0);
    data.copy(padded, 0, offset, offset + actualCompSize);
    const reader = new BitReader(padded);
    if (blockIndex > 0) decoder.headerRead = true;

    // Last block (declared size > available) — use sub-frames for partial recovery
    if (compBlockSize > actualCompSize) {
      let blockOut = 0;
      while (blockOut < uncompBlockSize) {
        const frameSz = Math.min(FRAME_SIZE, uncompBlockSize - blockOut);
        try {
          const frame = decoder.decompress(reader, frameSz);
          for (let i = 0; i < frame.length && outPos < expectedSize; i++)
            output[outPos++] = frame[i];
          blockOut += frameSz;
        } catch { break; }
      }
      break; // Last block — done
    }

    try {
      const result = decoder.decompress(reader, uncompBlockSize);
      for (let i = 0; i < result.length && outPos < expectedSize; i++)
        output[outPos++] = result[i];
    } catch {
      break;
    }

    offset += actualCompSize;
    blockIndex++;
  }
  return output.subarray(0, outPos);
}

/**
 * XMem LZX decompression with 2-byte block headers and concatenated stream.
 * Strips block headers, concatenates compressed data, and uses a single
 * BitReader + LzxDecoder. The LZX block structure spans transport chunks;
 * blockRemaining carries over between chunks. The bit reader is realigned
 * to each chunk boundary between frames.
 * Supports 0xFF last-block marker: FF [uncompSize:2 BE] [compSize:2 BE].
 */
function decompressXMem2ByteHeadersConcatenated(
  data: Buffer,
  expectedSize: number,
  windowBits: number,
): Buffer {
  const BLOCK_OUTPUT = 0x8000;

  // Phase 1: Parse block headers and compute frame sizes
  const chunks: Buffer[] = [];
  const frameSizes: number[] = [];
  let scanOffset = 0;

  while (scanOffset < data.length) {
    if (data[scanOffset] === 0xff && scanOffset + 5 <= data.length) {
      const lastUncomp = data.readUInt16BE(scanOffset + 1);
      const lastComp = data.readUInt16BE(scanOffset + 3);
      scanOffset += 5;
      if (scanOffset + lastComp > data.length) break;
      chunks.push(data.subarray(scanOffset, scanOffset + lastComp));
      frameSizes.push(lastUncomp);
      scanOffset += lastComp;
      break;
    }
    if (scanOffset + 2 > data.length) break;
    const compSize = data.readUInt16BE(scanOffset);
    scanOffset += 2;
    if (compSize === 0) break;
    if (scanOffset + compSize > data.length) break;
    chunks.push(data.subarray(scanOffset, scanOffset + compSize));
    frameSizes.push(BLOCK_OUTPUT);
    scanOffset += compSize;
  }

  if (chunks.length === 0) throw new Error("No blocks found");

  // Include any trailing bytes after the last block as padding
  // (the LZX bit reader may need a few extra bytes for lookahead)
  if (scanOffset < data.length) {
    chunks.push(data.subarray(scanOffset));
  }

  // Phase 2: Concatenate compressed data
  const totalComp = chunks.reduce((s, c) => s + c.length, 0);
  const concat = Buffer.alloc(totalComp);
  let pos = 0;
  const chunkOffsets: number[] = [];
  for (const chunk of chunks) {
    chunkOffsets.push(pos);
    chunk.copy(concat, pos);
    pos += chunk.length;
  }

  // Phase 3: Decompress with a single reader, realigning to chunk boundaries
  const reader = new BitReader(concat);
  const decoder = new LzxDecoder(windowBits);
  const output = Buffer.alloc(expectedSize);
  let outPos = 0;

  for (let i = 0; i < frameSizes.length; i++) {
    const frameSize = frameSizes[i];

    if (i > 0) {
      reader._offset = chunkOffsets[i];
      reader._bitOffset = 0;
      // Do NOT reset block state -- LZX blocks span transport chunks.
      // blockRemaining carries over from the previous chunk.
    }

    const frame = decoder.decompress(reader, frameSize);
    for (let j = 0; j < frame.length && outPos < expectedSize; j++) {
      output[outPos++] = frame[j];
    }
  }

  return output.subarray(0, outPos);
}

export function parseForzaZip(
  zipPath: string
): { buf: Buffer; entries: ZipEntry[] } {
  const buf = Buffer.from(readFileSync(zipPath));
  const entries: ZipEntry[] = [];

  // Find End of Central Directory record (scan backwards)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return { buf, entries };

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdCount = buf.readUInt16LE(eocdOffset + 10);

  // Parse central directory entries
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50)
      break;

    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf
      .subarray(pos + 46, pos + 46 + nameLen)
      .toString("utf8");

    // Read local file header to get actual data start
    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtraLen;

    entries.push({ name, compSize, uncompSize, dataStart });

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return { buf, entries };
}

export function findForzaInstall(): string | null {
  const vdfPath =
    "C:/Program Files (x86)/Steam/steamapps/libraryfolders.vdf";
  if (!existsSync(vdfPath)) return null;

  const content = readFileSync(vdfPath, "utf8");

  // Parse library paths from VDF
  const pathRegex = /"path"\s+"([^"]+)"/g;
  let match;
  const paths: string[] = [];

  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1].replace(/\\\\/g, "/").replace(/\\/g, "/"));
  }

  for (const libPath of paths) {
    const forzaPath = `${libPath}/steamapps/common/Forza Motorsport`;
    if (existsSync(forzaPath)) {
      return forzaPath;
    }
  }

  return null;
}
