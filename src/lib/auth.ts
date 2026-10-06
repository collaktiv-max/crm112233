/** Tom lista = alla inloggade släpps in (registrering bör ändå vara avstängd i Supabase). */
export function isAllowedEmail(email: string | undefined | null): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return !!email && allowed.includes(email.toLowerCase());
}
