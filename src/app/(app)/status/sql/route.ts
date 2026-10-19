import { readFile } from "node:fs/promises";
import path from "node:path";

const REPAIR_SQL_FILE = "supabase/migrations/20261019000000_repair_setup.sql";

/** Reparationsfilen som text, så att den kan kopieras direkt från statussidan. */
export async function GET() {
  const sql = await readFile(path.join(process.cwd(), REPAIR_SQL_FILE), "utf8");
  return new Response(sql, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
