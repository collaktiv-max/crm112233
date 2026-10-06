// Vercels Supabase-koppling sätter variablerna automatiskt; nyare projekt
// kan använda "publishable key" i stället för "anon key".
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
