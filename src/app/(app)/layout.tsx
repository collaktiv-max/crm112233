import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <>
      <Sidebar userName={personName(data.user?.email ?? null)} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] lg:ml-60 lg:max-w-none lg:px-8 lg:pb-10 lg:pt-8">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
