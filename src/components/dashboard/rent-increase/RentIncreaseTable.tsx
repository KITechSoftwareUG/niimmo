import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface RentIncreaseEligibility {
  mietvertrag_id: string;
  current_kaltmiete: number;
  letzte_mieterhoehung_am: string | null;
  start_datum: string;
  is_eligible: boolean;
  months_since_last_increase: number;
  months_since_start: number;
  reason: string;
}

interface ContractsDataItem {
  id: string;
  kaltmiete?: number;
  start_datum?: string;
  letzte_mieterhoehung_am?: string | null;
  einheiten?: {
    id: string;
    immobilien?: {
      name?: string;
      adresse?: string;
    } | null;
  } | null;
  mietvertrag_mieter?: Array<{
    mieter?: {
      vorname?: string;
      nachname?: string;
      hauptmail?: string | null;
    } | null;
  }> | null;
}

interface RentIncreaseTableProps {
  rows: RentIncreaseEligibility[];
  contractsData: ContractsDataItem[] | undefined;
  generatingPdf: string | null;
  onGeneratePdf: (contractId: string) => void;
  onOpenContract?: (contractId: string) => void;
}

export function RentIncreaseTable({
  rows,
  contractsData,
  generatingPdf,
  onGeneratePdf,
  onOpenContract,
}: RentIncreaseTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Immobilie</TableHead>
          <TableHead>Mieter</TableHead>
          <TableHead>Aktuelle Miete</TableHead>
          <TableHead>Letzte Erhöhung</TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((contract) => {
          const contractDetails = contractsData?.find((c) => c.id === contract.mietvertrag_id);
          const propertyName = contractDetails?.einheiten?.immobilien?.name || "Unbekannt";
          const tenant = contractDetails?.mietvertrag_mieter?.[0]?.mieter;
          const tenantName = tenant ? `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim() || "Unbekannt" : "Unbekannt";
          const lastIncrease = contract.letzte_mieterhoehung_am
            ? new Date(contract.letzte_mieterhoehung_am).toLocaleDateString("de-DE")
            : "Nie";

          return (
            <TableRow key={contract.mietvertrag_id}>
              <TableCell className="font-medium">{propertyName}</TableCell>
              <TableCell>{tenantName}</TableCell>
              <TableCell>{contract.current_kaltmiete.toFixed(2)}€</TableCell>
              <TableCell>{lastIncrease}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGeneratePdf(contract.mietvertrag_id)}
                    disabled={generatingPdf === contract.mietvertrag_id}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {generatingPdf === contract.mietvertrag_id ? "Erstellt..." : "PDF erstellen"}
                  </Button>
                  {onOpenContract && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenContract(contract.mietvertrag_id)}
                    >
                      Öffnen
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
