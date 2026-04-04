/**
 * Copies all data files (.csv, .json) from shared/ to dist/data/,
 * preserving directory structure. Used by the production build so
 * the compiled binary can find game data at runtime.
 */
import { cpSync, mkdirSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dir, "..");
const DIST = path.resolve(ROOT, "dist", "data");

let count = 0;

function copyFile(src: string, dest: string) {
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest);
  count++;
}

function copyDir(srcDir: string, destDir: string, filter?: (name: string) => boolean) {
  try {
    const entries = readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        copyDir(path.join(srcDir, entry.name), path.join(destDir, entry.name), filter);
      } else if (!filter || filter(entry.name)) {
        copyFile(path.join(srcDir, entry.name), path.join(destDir, entry.name));
      }
    }
  } catch {}
}

// Copy all data files (.csv, .json) from shared/ preserving directory structure
const sharedDir = path.join(ROOT, "shared");
copyDir(sharedDir, DIST, (name) => name.endsWith(".csv") || name.endsWith(".json"));

console.log(`Copied ${count} data files → ${DIST}`);
