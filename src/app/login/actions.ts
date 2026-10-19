"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

type SignInState = { error: string; email: string } | null;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!isAllowedEmail(email)) return { error: "Den här mejladressen har inte behörighet.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { error: "Kontot är inte bekräftat. Kryssa i Auto Confirm User när du skapar det i Supabase.", email };
    }
    if (!error.status || error.status >= 500 || /fetch failed|invalid api key/i.test(error.message)) {
      return { error: "Appen når inte databasen. Kontrollera Supabase-variablerna i Vercel.", email };
    }
    return { error: "Fel mejl eller lösenord.", email };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
