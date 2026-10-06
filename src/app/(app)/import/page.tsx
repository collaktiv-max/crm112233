import { ImportClient } from "@/components/ImportClient";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="h1">Importera</h1>
        <p className="text-sm text-gray-500">
          Börja med dina 18 betalande partners och UF-årets företag. Dubbletter (samma namn och kommun) hoppas över.
        </p>
      </header>
      <ImportClient />
    </div>
  );
}
