import Image from "next/image";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fel?: string }> }) {
  const { fel } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <Image src="/collaktiv-mark.svg" alt="Collaktiv" width={70} height={56} className="mx-auto mb-4" priority />
        <h1 className="h1">Collaktiv CRM</h1>
        <p className="mt-1 text-sm text-muted">Logga in för att fortsätta sälja</p>
      </div>
      {fel === "behorighet" && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Kontot har inte behörighet.</p>
      )}
      <LoginForm />
    </main>
  );
}
