import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fel?: string }> }) {
  const { fel } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand" />
        <h1 className="h1">Collaktiv CRM</h1>
        <p className="mt-1 text-sm text-gray-500">Logga in för att fortsätta sälja</p>
      </div>
      {fel === "behorighet" && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Kontot har inte behörighet.</p>
      )}
      <LoginForm />
    </main>
  );
}
