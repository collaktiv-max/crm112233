import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
      <BottomNav />
    </>
  );
}
