import type { TelemetryPacket } from "../shared/types";

/**
 * Compute NormSuspensionTravel from SuspensionTravelM for games that
 * don't provide it natively (F1, ACC). Forza provides it directly.
 * Uses 20-80mm range (typical GT3/F1 suspension travel).
 */
export function fillNormSuspension(p: TelemetryPacket): void {
  if (p.NormSuspensionTravelFL === 0 && p.SuspensionTravelMFL > 0) {
    const norm = (v: number) => Math.max(0, Math.min(1, (v * 1000 - 20) / 60));
    p.NormSuspensionTravelFL = norm(p.SuspensionTravelMFL);
    p.NormSuspensionTravelFR = norm(p.SuspensionTravelMFR);
    p.NormSuspensionTravelRL = norm(p.SuspensionTravelMRL);
    p.NormSuspensionTravelRR = norm(p.SuspensionTravelMRR);
  }
}
