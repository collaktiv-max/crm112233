import Link from "next/link";
import { explainDbError, type DbError } from "@/lib/dbErrors";

/** Röd ruta när en databasfråga misslyckas, i stället för en tyst tom lista. */
export function DbNotice({ errors }: { errors: DbError[] }) {
  const first = errors.find(Boolean);
  if (!first) return null;
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">Databasen svarar inte som den ska</p>
      <p className="mt-1">{explainDbError(first)}</p>
      <Link href="/status" className="mt-2 inline-block font-semibold text-red-900 underline">Öppna Status →</Link>
    </div>
  );
}
