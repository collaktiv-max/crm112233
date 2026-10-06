"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Mejl</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} key={state?.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Lösenord</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
