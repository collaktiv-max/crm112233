import { ImportClient } from "@/components/ImportClient";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="h1">Importera</h1>
        <p className="text-sm text-gray-500">
          Börja med UF-årets företag och listor från handelsnätverken. Välj Kontaktad eller Dialog för dem du redan pratat med. Dubbletter (samma namn och kommun) hoppas över.
        </p>
      </header>
      <ImportClient />
    </div>
  );
}
