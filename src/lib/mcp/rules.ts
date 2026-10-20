import { timingSafeEqual } from "node:crypto";
import { STAGES, type Stage } from "../constants.ts";

/**
 * Regler för vad Claude får göra i CRM:et. Claude ändrar aldrig betalstatus:
 * stegen Betald partner och Live sätts bara av en människa (eller av betalningen).
 */
export const CLAUDE_FORBIDDEN_STAGES: readonly Stage[] = ["betald", "live"];
export const CLAUDE_STAGES = STAGES.filter((s) => !CLAUDE_FORBIDDEN_STAGES.includes(s)) as [Stage, ...Stage[]];

/** Det som visas som "loggad av" när Claude skriver en aktivitet. */
export const CLAUDE_ACTOR = "claude@collaktiv.se";

const FREE_MAIL = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.se", "yahoo.com", "icloud.com", "telia.com", "hotmail.se", "me.com"]);

/** "anna@kafe.se" → "kafe.se"; null för gratis-mejl där domänen inte säger något om företaget. */
export function companyDomain(emailOrUrl: string | null | undefined): string | null {
  if (!emailOrUrl) return null;
  const raw = emailOrUrl.trim().toLowerCase();
  let host: string | null = null;
  if (raw.includes("@")) host = raw.split("@").pop() ?? null;
  else {
    try {
      host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname;
    } catch {
      return null;
    }
  }
  if (!host) return null;
  host = host.replace(/^www\./, "");
  return FREE_MAIL.has(host) ? null : host;
}

/** Konstanttidsjämförelse av hemligheten i kopplings-URL:en. */
export function secretMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
