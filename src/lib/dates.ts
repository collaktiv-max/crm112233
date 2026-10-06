const TZ = "Europe/Stockholm";

/** Dagens datum i Sverige som YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "idag", "imorgon", "igår", "om 3 dagar", "5 dagar sedan" eller datum. */
export function relativeDay(isoDate: string, ref: string = today()): string {
  const diff = daysBetween(ref, isoDate);
  if (diff === 0) return "idag";
  if (diff === 1) return "imorgon";
  if (diff === -1) return "igår";
  if (diff > 1 && diff <= 14) return `om ${diff} dagar`;
  if (diff < -1 && diff >= -30) return `${-diff} dagar sedan`;
  return formatDate(isoDate);
}

export function formatDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("sv-SE", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
