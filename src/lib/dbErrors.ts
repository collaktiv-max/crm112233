export type DbError = { code?: string; message: string } | null | undefined;

const STATUS_HINT = "Öppna Status i menyn för att se vad som behöver göras.";

/** Översätter Postgres/PostgREST-fel till något begripligt på svenska. */
export function explainDbError(error: DbError): string | null {
  if (!error) return null;
  const { code = "", message } = error;
  if (code === "42P01" || code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(message)) {
    return `Databasen saknar tabeller – reparationsfilen har inte körts i det här Supabase-projektet. ${STATUS_HINT}`;
  }
  if (code === "42703" || code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(message)) {
    return `Databasen har en äldre version av schemat. ${STATUS_HINT}`;
  }
  if (code === "42883" || code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(message)) {
    return `Databasen saknar teamfunktionen. ${STATUS_HINT}`;
  }
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return `Ditt konto har inte behörighet i databasen (finns inte i teamet). ${STATUS_HINT}`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT/i.test(message)) {
    return `Appen når inte databasen – kontrollera Supabase-variablerna i Vercel. ${STATUS_HINT}`;
  }
  return message;
}
