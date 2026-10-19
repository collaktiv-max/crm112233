import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { explainDbError, type DbError } from "@/lib/dbErrors";
import { CopySqlButton } from "@/components/CopySqlButton";

export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean; detail: string };

function projectRef(url: string | undefined): string | null {
  const m = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return m ? m[1] : null;
}

function fromError(label: string, error: DbError, okDetail: string): Check {
  return error ? { label, ok: false, detail: explainDbError(error)! } : { label, ok: true, detail: okDetail };
}

export default async function StatusPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email?.toLowerCase() ?? null;
  const ref = projectRef(SUPABASE_URL);
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  const [tables, column, member, team] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("activities").select("logged_by").limit(1),
    supabase.rpc("is_team_member"),
    supabase.from("team_members").select("email").order("email"),
  ]);

  const checks: Check[] = [
    {
      label: "Kopplad till Supabase",
      ok: !!SUPABASE_URL && !!SUPABASE_KEY,
      detail: SUPABASE_URL ? `Projekt: ${ref ?? SUPABASE_URL}` : "NEXT_PUBLIC_SUPABASE_URL saknas i Vercel",
    },
    { label: "Inloggad", ok: !!email, detail: email ?? "Ingen användare" },
    fromError("Tabellerna finns", tables.error, `${tables.count ?? 0} företag syns för dig`),
    fromError("Senaste schemaversionen", column.error, "Allt finns på plats"),
    member.error
      ? fromError("Du är med i teamet", member.error, "")
      : {
          label: "Du är med i teamet",
          ok: member.data === true,
          detail: member.data ? "Ja – du ser och redigerar teamets data" : `${email} finns inte i team_members – du ser ingen data och kan inte spara`,
        },
  ];
  const allOk = checks.every((c) => c.ok);
  const sqlEditor = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="h1">Status</h1>
        <p className="text-sm text-gray-500">Kontroll av kopplingen mellan appen och databasen.</p>
      </header>

      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
        {checks.map((c) => (
          <li key={c.label} className="flex gap-3 p-4">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.ok ? "bg-accent text-brand-dark" : "bg-red-100 text-red-700"}`}>
              {c.ok ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{c.label}</p>
              <p className={`break-words text-sm ${c.ok ? "text-gray-500" : "text-red-700"}`}>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {allOk ? (
        <div className="card border-brand/30 bg-accent-light/50 text-sm">
          <p className="font-semibold text-brand">Allt fungerar 🎉</p>
          <Link href="/" className="mt-1 inline-block font-semibold text-brand">Till Idag →</Link>
        </div>
      ) : (
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Så här fixar du det</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Tryck på knappen nedan. Den kopierar en SQL-fil som rättar databasen oavsett vilket läge den är i. Befintlig data rörs inte.
              <div className="mt-2"><CopySqlButton /></div>
            </li>
            <li>
              Öppna{" "}
              <a href={sqlEditor} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                SQL Editor i rätt Supabase-projekt{ref ? ` (${ref})` : ""}
              </a>
              , klistra in och tryck <b>Run</b>. Det ska stå <i>Success</i>.
            </li>
            <li>
              Ladda om den här sidan. Alla konton som finns i Supabase läggs till i teamet automatiskt.
            </li>
          </ol>
          {!email || member.data === false ? (
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Saknas ditt konto i Supabase? Skapa det under Authentication → Users → Add user och kör sedan SQL-filen igen.
            </p>
          ) : null}
        </section>
      )}

      <section className="card space-y-2 text-sm">
        <h2 className="h2">Teamet</h2>
        {team.error ? (
          <p className="text-gray-500">Syns när databasen är reparerad.</p>
        ) : (
          <ul className="space-y-1">
            {(team.data ?? []).map((m) => (
              <li key={m.email} className="flex justify-between">
                <span>{m.email}</span>
                {m.email === email && <span className="text-xs font-semibold text-brand">du</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="pt-2 text-xs text-gray-500">
          Får logga in (ALLOWED_EMAILS i Vercel): {allowed.length ? allowed.join(", ") : "alla – sätt ALLOWED_EMAILS!"}
        </p>
      </section>
    </div>
  );
}
