import { describe, test, expect } from "bun:test";

// We can't test actual shared memory without ACC running,
// but we can test the buffer reading utilities
describe("ACC shared memory utilities", () => {
  test("readWString extracts null-terminated UTF-16LE string from buffer", async () => {
    const { readWString } = await import("../server/games/acc/shared-memory");
    // "Monza" in UTF-16LE
    const buf = Buffer.alloc(20);
    buf.write("Monza", 0, "utf16le");
    expect(readWString(buf, 0, 20)).toBe("Monza");
  });

  test("readWString handles empty string", async () => {
    const { readWString } = await import("../server/games/acc/shared-memory");
    const buf = Buffer.alloc(20);
    expect(readWString(buf, 0, 20)).toBe("");
  });
});
