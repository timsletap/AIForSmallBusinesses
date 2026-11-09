import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived signed tokens for public discovery: the search step signs each candidate URL, and the
 * one-vendor process step only accepts URLs it signed. Stops the process endpoint being used to make
 * the server fetch arbitrary sites.
 */
const TTL_MS = 15 * 60_000;

function secret(): string {
  const s = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("CRON_SECRET or ADMIN_PASSWORD must be set to sign discovery tokens");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signCandidate(runId: string, url: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${sign(`${runId}|${url}|${exp}`)}`;
}

export function verifyCandidate(runId: string, url: string, token: string, now = Date.now()): boolean {
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!mac || !Number.isFinite(exp) || exp < now) return false;
  const want = Buffer.from(sign(`${runId}|${url}|${exp}`));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got);
}
