import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-center">
      <h1 className="h1">Hittades inte</h1>
      <Link href="/" className="mt-4 inline-block font-semibold text-brand">Till Idag</Link>
    </main>
  );
}
