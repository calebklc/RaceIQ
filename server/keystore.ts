/**
 * Secure credential store using Windows Credential Manager.
 * Credentials are managed by the OS and tied to the current user.
 */
import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { join } from "path";
import { IS_COMPILED } from "./paths";

const SCRIPT_PATH = IS_COMPILED
  ? resolve(dirname(process.execPath), "credstore.ps1")
  : resolve(dirname(fileURLToPath(import.meta.url)), "credstore.ps1");

function ps(args: string): string {
  return execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${SCRIPT_PATH}" ${args}`,
    { encoding: "utf-8", windowsHide: true, timeout: 5000 },
  ).trim();
}

export async function getSecret(key: string): Promise<string> {
  try {
    // Use file-based output to avoid PowerShell stdout encoding issues
    const tmpFile = join(tmpdir(), `raceiq-cred-${process.pid}`);
    ps(`read "RaceIQ:${key}" "" "${tmpFile}"`);
    const value = readFileSync(tmpFile, "utf-8");
    try { unlinkSync(tmpFile); } catch {}
    return value;
  } catch {
    return "";
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    if (!value) {
      ps(`delete "RaceIQ:${key}"`);
    } else {
      ps(`write "RaceIQ:${key}" "${value}"`);
    }
  } catch {}
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    ps(`delete "RaceIQ:${key}"`);
  } catch {}
}
