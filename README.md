# Collaktiv CRM

Mobil-först-CRM för att sälja Collaktiv-partnerskap i Gävleborg. Mål: 50 betalande partners före årsskiftet.

**MVP:** företagslista med filter · pipeline som kanban · företagskort med historik · snabblogg från
mobilen · Idag-vy med uppföljningar och Dagens lista · CSV-import · dashboard mot målet 50.

## Kom igång (produktion)

1. **Supabase:** skapa ett projekt på [supabase.com](https://supabase.com). Kör migrationen, antingen
   - `npx supabase link --project-ref <ref> && npx supabase db push`, eller
   - klistra in `supabase/migrations/20261006000000_init.sql` i SQL Editor.
2. **Användare:** Authentication → Users → *Add user* (mejl + lösenord, *Auto confirm*).
   Stäng sedan av *Allow new users to sign up* under Authentication → Sign In / Providers.
3. **Vercel:** importera repot, lägg in miljövariablerna från `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAILS`).
4. **Domän:** lägg till `crm.collaktiv.se` i Vercel och en CNAME hos Loopia mot `cname.vercel-dns.com`.
5. **Mobilen:** öppna sidan i Safari/Chrome → *Lägg till på hemskärmen*.

## Lokalt

```bash
npm install
npx supabase start          # kräver Docker, kör migrationen automatiskt
cp .env.example .env.local  # fyll i API URL + anon key från `supabase start`
npm run dev
```

Skapa en lokal användare i Studio (http://127.0.0.1:54323) eller via admin-API:t.

## Import

`examples/partners-exempel.csv` visar formatet. Rubriker känns igen på svenska och engelska
(namn, kommun, kategori, nätverk, adress, instagram, kontaktperson, roll, mejl, telefon, steg …).
Välj standardsteg vid importen, t.ex. *Betald partner* för de 18 betalande och *Prospekt* för UF-listan.
Dubbletter (samma namn + kommun) hoppas över.

## Prioritetspoäng (0–100)

| Signal | Poäng |
|---|---|
| Kategori: Mat & dryck / Fika (Mode / Handel) | 30 (25) |
| Nära hållplats/resecentrum | 20 |
| Lokalt ägt (okänt) | 20 (10) |
| Nätverk med befintlig betalande partner (nätverk utan) | 15 (5) |
| Instagram eller Facebook | 15 |

## GDPR

Spara bara jobbkontakter. Markera enskilda firmor. Avregistrering sparas på företagskortet.
Förlorade företag utan kontakt på 12 månader rensas med `select purge_stale_lost_companies();`
(schemalägg med pg_cron, se kommentar i migrationen).

## Nästa steg (vecka 2+)

Google Places-import + poängsättning via Trafiklab-hållplatser, AI-utkast till mejl/DM,
kalender- och Gmail-synk, CRM:et som MCP-server, synk med Företagsportalen.
