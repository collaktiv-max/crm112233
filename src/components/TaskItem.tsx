"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { postponeTask, setTaskDone } from "@/lib/actions";
import { addDays, relativeDay, today } from "@/lib/dates";

type Props = {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  company?: { id: string; name: string } | null;
};

export function TaskItem({ id, title, dueDate, done, company }: Props) {
  const [pending, start] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const t = today();
  const overdue = !optimisticDone && dueDate < t;

  return (
    <li className={`flex items-start gap-3 py-3 ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        aria-label={optimisticDone ? "Markera som ej klar" : "Markera som klar"}
        onClick={() =>
          start(async () => {
            setOptimisticDone(!optimisticDone);
            await setTaskDone(id, !optimisticDone);
          })
        }
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          optimisticDone ? "border-brand bg-brand text-white" : "border-gray-300"
        }`}
      >
        {optimisticDone && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${optimisticDone ? "text-gray-400 line-through" : ""}`}>{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {company && (
            <Link href={`/foretag/${company.id}`} className="font-semibold text-brand">
              {company.name}
            </Link>
          )}
          {company && " · "}
          <span className={overdue ? "font-semibold text-red-600" : ""}>{relativeDay(dueDate, t)}</span>
        </p>
      </div>
      {!optimisticDone && (
        <div className="flex shrink-0 gap-1">
          {company && (
            <Link href={`/logga?foretag=${company.id}`} className="rounded-lg bg-accent-light px-2 py-1 text-xs font-semibold text-brand">
              Logga
            </Link>
          )}
          <button
            type="button"
            onClick={() => start(() => postponeTask(id, addDays(t, 1)))}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600"
          >
            Imorgon
          </button>
        </div>
      )}
    </li>
  );
}
