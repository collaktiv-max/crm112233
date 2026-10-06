import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_LABELS, CHANNEL_LABELS, PACKAGE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, personName, relativeDay } from "@/lib/dates";
import { ScoreBadge, StageBadge } from "@/components/StageBadge";
import { StageMover } from "@/components/StageMover";
import { TaskItem } from "@/components/TaskItem";
import { AddContact, AddTask, ContractEditor, DeleteContactButton, UnsubscribeToggle } from "@/components/CompanyForms";
import type { Activity, Company, Contact, Contract, Task } from "@/lib/types";

const ACTIVITY_ICONS = { besok: "🚶", samtal: "📞", mejl: "✉️", dm: "💬" } as const;

function externalUrl(value: string, base?: string) {
  if (/^https?:\/\//.test(value)) return value;
  if (base) return `${base}${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [companyRes, contactsRes, contractsRes, activitiesRes, tasksRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).maybeSingle<Company>(),
    supabase.from("contacts").select("*").eq("company_id", id).order("is_decision_maker", { ascending: false }).returns<Contact[]>(),
    supabase.from("contracts").select("*").eq("company_id", id).order("created_at").returns<Contract[]>(),
    supabase.from("activities").select("*").eq("company_id", id).order("occurred_at", { ascending: false }).returns<Activity[]>(),
    supabase.from("tasks").select("*").eq("company_id", id).order("done").order("due_date").returns<Task[]>(),
  ]);

  const c = companyRes.data;
  if (!c) notFound();
  const contacts = contactsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const openTasks = tasks.filter((t) => !t.done);
  const primary = contacts[0];
  const phone = primary?.phone ?? c.phone;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/foretag" className="text-sm font-semibold text-brand">← Företag</Link>
        <Link href={`/foretag/${id}/redigera`} className="text-sm font-semibold text-gray-600">Redigera</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="space-y-6">
          <header className="space-y-2">
            <div className="flex items-start gap-3">
              <ScoreBadge score={c.priority_score} />
              <div className="min-w-0 flex-1">
                <h1 className="h1 leading-tight">{c.name}</h1>
                <p className="text-sm text-gray-500">
                  {[c.category, c.network, c.municipality].filter(Boolean).join(" · ") || "–"}
                </p>
              </div>
              <StageBadge stage={c.stage} />
            </div>
            {c.stage === "forlorad" && c.lost_reason && (
              <p className="rounded-xl bg-red-50 p-2 text-sm text-red-800">Förlorad: {c.lost_reason}</p>
            )}
            {c.stage === "aterkom" && c.revisit_date && (
              <p className="rounded-xl bg-purple-50 p-2 text-sm text-purple-800">Återkom {formatDate(c.revisit_date)}</p>
            )}
            {c.unsubscribed_at && (
              <p className="rounded-xl bg-gray-100 p-2 text-sm text-gray-700">Avregistrerad från utskick {formatDate(c.unsubscribed_at)}</p>
            )}
          </header>

          <div className="grid grid-cols-4 gap-2">
            <Link href={`/logga?foretag=${id}`} className="btn-primary col-span-2 px-2">+ Logga</Link>
            {phone ? <a href={`tel:${phone}`} className="btn-secondary px-2">Ring</a> : <span className="btn-secondary px-2 opacity-40">Ring</span>}
            {primary?.email ? (
              <a href={`mailto:${primary.email}`} className="btn-secondary px-2">Mejla</a>
            ) : c.instagram ? (
              <a href={externalUrl(c.instagram, "https://instagram.com/")} target="_blank" rel="noreferrer" className="btn-secondary px-2">IG</a>
            ) : (
              <span className="btn-secondary px-2 opacity-40">Mejla</span>
            )}
          </div>

          <section className="card">
            <StageMover companyId={id} stage={c.stage} />
            {c.next_step && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-sm">
                <span className="font-semibold">Nästa steg:</span> {c.next_step}
                {c.next_step_date && <span className="text-gray-500"> · {relativeDay(c.next_step_date)}</span>}
              </p>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="h2">Uppgifter</h2>
              <AddTask companyId={id} />
            </div>
            {openTasks.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">Inga öppna uppgifter.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {openTasks.map((t) => (
                  <TaskItem key={t.id} id={t.id} title={t.title} dueDate={t.due_date} done={t.done} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Dator: högerkolumn med kontakter, avtal och fakta. */}
        <aside className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="h2">Kontaktpersoner</h2>
              <AddContact companyId={id} />
            </div>
            {contacts.length === 0 && <p className="text-sm text-gray-500">Ingen kontaktperson ännu.</p>}
            <ul className="space-y-2">
              {contacts.map((p) => (
                <li key={p.id} className="card flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {p.name} {p.is_decision_maker && <span className="ml-1 rounded bg-accent-light px-1.5 py-0.5 text-[10px] font-bold text-brand">BESLUTAR</span>}
                    </p>
                    {p.role && <p className="text-gray-500">{p.role}</p>}
                    <p className="mt-1 flex flex-wrap gap-x-3">
                      {p.phone && <a href={`tel:${p.phone}`} className="text-brand">{p.phone}</a>}
                      {p.email && <a href={`mailto:${p.email}`} className="truncate text-brand">{p.email}</a>}
                      {p.preferred_channel && <span className="text-gray-500">Föredrar {CHANNEL_LABELS[p.preferred_channel].toLowerCase()}</span>}
                    </p>
                  </div>
                  <DeleteContactButton id={p.id} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="h2">Avtal</h2>
              {contracts.length === 0 && <ContractEditor companyId={id} />}
            </div>
            {contracts.length === 0 && <p className="text-sm text-gray-500">Inget avtal ännu.</p>}
            <ul className="space-y-2">
              {contracts.map((k) => (
                <li key={k.id} className="card space-y-1 p-3 text-sm">
                  <p className="font-semibold">
                    {PACKAGE_LABELS[k.package]} {k.founding_partner && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">FOUNDING</span>}
                  </p>
                  <p className="text-gray-600">
                    6 mån: {k.list_price.toLocaleString("sv-SE")} kr ·{" "}
                    {k.paid_at ? (
                      <span className="font-semibold text-brand">Betalt {(k.amount_paid ?? 0).toLocaleString("sv-SE")} kr {formatDate(k.paid_at)}</span>
                    ) : (
                      <span className="font-semibold text-orange-700">Ej betalt</span>
                    )}
                  </p>
                  {(k.start_date || k.end_date) && (
                    <p className="text-gray-500">
                      {k.start_date && formatDate(k.start_date)} – {k.end_date && formatDate(k.end_date)}
                    </p>
                  )}
                  <ContractEditor companyId={id} contract={k} />
                </li>
              ))}
            </ul>
          </section>

          <section className="card space-y-2 text-sm">
            <h2 className="h2">Uppgifter om företaget</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {c.address && (<><dt className="text-gray-500">Adress</dt><dd>{c.address}</dd></>)}
              {c.org_nr && (<><dt className="text-gray-500">Org.nr</dt><dd>{c.org_nr}</dd></>)}
              {c.phone && (<><dt className="text-gray-500">Telefon</dt><dd><a className="text-brand" href={`tel:${c.phone}`}>{c.phone}</a></dd></>)}
              {c.website && (<><dt className="text-gray-500">Webb</dt><dd className="truncate"><a className="text-brand" href={externalUrl(c.website)} target="_blank" rel="noreferrer">{c.website}</a></dd></>)}
              {c.instagram && (<><dt className="text-gray-500">Instagram</dt><dd><a className="text-brand" href={externalUrl(c.instagram, "https://instagram.com/")} target="_blank" rel="noreferrer">{c.instagram}</a></dd></>)}
              {c.facebook && (<><dt className="text-gray-500">Facebook</dt><dd className="truncate"><a className="text-brand" href={externalUrl(c.facebook, "https://facebook.com/")} target="_blank" rel="noreferrer">{c.facebook}</a></dd></>)}
              <dt className="text-gray-500">Ägande</dt>
              <dd>{c.is_chain === true ? "Kedja" : c.is_chain === false ? "Lokalt ägt" : "Okänt"}{c.is_sole_trader && " · enskild firma"}</dd>
              <dt className="text-gray-500">Hållplats</dt>
              <dd>{c.near_transit ? "Nära hållplats" : "–"}</dd>
            </dl>
            {c.notes && <p className="whitespace-pre-line border-t border-gray-100 pt-2">{c.notes}</p>}
            <div className="border-t border-gray-100 pt-2">
              <UnsubscribeToggle companyId={id} unsubscribed={!!c.unsubscribed_at} />
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          <section>
            <h2 className="h2 mb-2">Historik</h2>
            {activities.length === 0 && <p className="text-sm text-gray-500">Ingen kontakt loggad ännu.</p>}
            <ol className="relative space-y-3 border-l-2 border-gray-100 pl-4">
              {activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs">{ACTIVITY_ICONS[a.type]}</span>
                  <p className="font-semibold">
                    {ACTIVITY_LABELS[a.type]}
                    {a.outcome && <span className="font-normal text-gray-600"> · {a.outcome}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(a.occurred_at)}
                    {a.logged_by && ` · ${personName(a.logged_by)}`}
                  </p>
                  {a.objection && <p className="mt-1 text-xs text-orange-700">Invändning: {a.objection}</p>}
                  {a.note && <p className="mt-1 whitespace-pre-line text-gray-700">{a.note}</p>}
                </li>
              ))}
              <li className="text-xs text-gray-400">
                Skapad {formatDate(c.created_at)}
                {c.source && ` · källa: ${c.source}`} · i steget {STAGE_LABELS[c.stage]} sedan {formatDate(c.stage_changed_at)}
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
