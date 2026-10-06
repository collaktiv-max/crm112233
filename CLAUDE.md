@AGENTS.md

# Collaktiv CRM

Collaktiv AB bygger en app som belönar bussresenärer i Gävleborg med poäng som löses in hos lokala
företag. Det här CRM:et används av en säljare (Vilmer) för att sälja partnerskap till de företagen:
Standard 500 kr/mån, Premium 700 kr/mån, 6-månaderspaket. Founding Partner ger 20 % rabatt (max 25 st).
**Mål: 50 betalande partners före årsskiftet 2026/27.**

## Regler

- **Mobil först.** Används på plats i butiker. Allt ska fungera med tummen på en 390 px bred skärm.
- **Svenska i UI.** All text användaren ser är på svenska. Kod, tabell- och kolumnnamn är på engelska.
- **Minimal admin.** Ett besök ska gå att logga på under 30 sekunder (`/logga`).
- Claude skickar aldrig mejl eller ändrar betalstatus på egen hand – allt som når en kund godkänns.
- GDPR: spara bara jobbkontakter, notera källa, enskild firma = personuppgifter, respektera avregistrering.

## Stack

Next.js 16 (App Router, `src/proxy.ts` i stället för middleware) + Supabase (Postgres, Auth, RLS)
+ Tailwind v4. Deploy på Vercel. PWA via `src/app/manifest.ts`.

Design: Montserrat, knappar `#166849` (`brand`), accent `#8fd34f` (`accent`), vit bakgrund.
Komponentklasser (`btn-primary`, `input`, `card`, `chip-on` …) definieras som `@utility` i `src/app/globals.css`.

## Pipeline

`prospekt → kontaktad → dialog → mote_bokat → onboarding → betald → live`, plus sidospåren
`forlorad` (kräver `lost_reason`) och `aterkom` (kräver `revisit_date`). Etiketter i `src/lib/constants.ts`.
Varje stegbyte skapar en automatisk uppföljning (`tasks.auto_stage`) via en databastrigger.

## Datamodell (`supabase/migrations/`)

- `companies` – navet: kategori, kommun, nätverk/plats, steg, prioritetspoäng, nästa steg, förlustanledning
- `contacts` – kontaktpersoner (jobbuppgifter)
- `contracts` – paket, Founding Partner, `list_price` (genererad), betalning
- `activities` – besök/samtal/mejl/DM med utfall och invändning
- `tasks` – uppgifter med förfallodatum

Logik som ligger i databasen (testa med SQL, inte bara i appen):
- `priority_score` räknas av `compute_priority_score()` vid varje insert/update
- automatiska uppföljningar i `companies_after_stage_change()`
- `last_contact_at` uppdateras när en aktivitet loggas
- max 25 Founding Partners
- `purge_stale_lost_companies()` för GDPR-rensning

All data har `owner_id default auth.uid()` och RLS `owner_id = auth.uid()`.

## Kod

- `src/lib/actions.ts` – alla server actions (mutationer)
- `src/lib/supabase/{server,client}.ts` – Supabase-klienter
- `src/app/(app)/` – inloggade sidor: Idag (`/`), `/foretag`, `/pipeline`, `/logga`, `/dashboard`, `/import`
- `src/components/` – klientkomponenter

## Kommandon

```bash
npm run dev            # http://localhost:3000
npm run lint
npm run typecheck
npm test               # node:test för src/lib
npx supabase start     # lokal Supabase (kräver Docker)
npx supabase db reset  # kör om migrationerna lokalt
```

Nya schemaändringar = ny fil i `supabase/migrations/`, ändra aldrig en redan körd migration.
