import { headers } from "next/headers";
import { CopyText } from "@/components/CopyText";
import { mcpConfigError } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Kör morgonrutinen.",
  "Vilka ska jag följa upp idag? Skriv mejlutkast till dem som har mejladress.",
  "Jag var precis hos Kafé Solen, ägaren Anna var positiv men vill prata med sin delägare. Logga det och påminn mig i kalendern på fredag kl 10.",
  "Boka in ett möte med Bistro Linden på torsdag kl 14 i min kalender och flytta dem till Möte bokat.",
  "Lägg in alla butiker i Valbo Köpcentrum som prospekt, källa: Valbos butikslista.",
  "Hur ligger vi till mot målet och vilka invändningar är vanligast?",
];

export default async function ClaudePage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const configError = mcpConfigError();
  const url = process.env.MCP_SECRET ? `${proto}://${host}/api/mcp/${process.env.MCP_SECRET}` : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="h1">Claude</h1>
        <p className="text-sm text-gray-500">
          Låt Claude läsa och uppdatera CRM:et, sätta påminnelser i din kalender och skriva mejlutkast åt dig.
        </p>
      </header>

      {configError || !url ? (
        <section className="card space-y-3 border-amber-300 bg-amber-50 text-sm">
          <p className="font-semibold">Kopplingen är inte aktiverad ännu</p>
          <p>{configError}</p>
          <p>Lägg till följande i <b>Vercel → Settings → Environment Variables</b> och gör sedan Redeploy:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>MCP_SECRET</code> – en lång slumpmässig sträng (minst 24 tecken). Fungerar som lösenord.</li>
            <li><code>MCP_USER_EMAIL</code> – mejladressen Claude ska agera som (ditt konto).</li>
            <li><code>SUPABASE_SERVICE_ROLE_KEY</code> – finns ofta redan via Supabase-kopplingen, annars Supabase → Project Settings → API Keys.</li>
          </ul>
        </section>
      ) : (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">1. Din kopplingsadress</h2>
          <p className="text-sm text-gray-600">Adressen innehåller en hemlig nyckel. Dela den inte – den ger full åtkomst till CRM:et.</p>
          <div className="flex items-center gap-2">
            <input className="input min-w-0 flex-1 py-2 font-mono text-xs" readOnly value={url} aria-label="Kopplingsadress" />
            <CopyText text={url} />
          </div>
        </section>
      )}

      <section className="card space-y-3 text-sm">
        <h2 className="text-lg font-bold">2. Lägg till i Claude</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Öppna <b>claude.ai → Inställningar → Kopplingar</b> (Connectors).</li>
          <li>Välj <b>Lägg till egen koppling</b>, ge den namnet <i>Collaktiv CRM</i> och klistra in adressen ovan.</li>
          <li>Slå på kopplingarna <b>Gmail</b> och <b>Google Kalender</b> på samma sida – det är dem Claude använder för utkast och påminnelser.</li>
          <li>I en ny chatt: tryck på verktygsikonen och kontrollera att alla tre kopplingarna är påslagna.</li>
        </ol>
      </section>

      <section className="card space-y-3 text-sm">
        <h2 className="text-lg font-bold">3. Prova</h2>
        <ul className="space-y-2">
          {EXAMPLES.map((e) => (
            <li key={e} className="rounded-xl bg-gray-50 p-3">”{e}”</li>
          ))}
        </ul>
        <p className="text-gray-600">
          Färdiga flöden finns också under kopplingens meny i Claude: <b>morgonrutin</b> och <b>uppfoljningsmejl</b>.
        </p>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="h2">Vad Claude får och inte får göra</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>Får: söka, läsa företagskort, lägga till företag och kontakter, logga kontakter, flytta i pipelinen, skapa och klarmarkera uppgifter.</li>
          <li>Skriver mejl som <b>utkast</b> – du granskar och skickar själv. Claude skickar aldrig.</li>
          <li>Får <b>inte</b> ändra betalstatus eller avtal, flytta till Betald partner/Live, eller radera något.</li>
          <li>Hoppar över företag som tackat nej till utskick.</li>
          <li>Allt Claude loggar syns som ”Claude” i historiken.</li>
        </ul>
      </section>
    </div>
  );
}
