import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export interface RentIncreaseEligibility {
  mietvertrag_id: string;
  current_kaltmiete: number;
  letzte_mieterhoehung_am: string | null;
  start_datum: string;
  is_eligible: boolean;
  months_since_last_increase: number;
  months_since_start: number;
  reason: string;
}

interface RentIncreaseSimpleTableProps {
  rows: RentIncreaseEligibility[];
  generatingPdf: string | null;
  onGeneratePdf: (contractId: string) => void;
  onOpenContract?: (contractId: string) => void;
}

function formatCurrencyEUR(value: number) {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE").format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function RentIncreaseSimpleTable({ rows, generatingPdf, onGeneratePdf, onOpenContract }: RentIncreaseSimpleTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vertrag</TableHead>
            <TableHead className="text-right">Kaltmiete</TableHead>
            <TableHead>Letzte Erhöhung</TableHead>
            <TableHead>Vertragsstart</TableHead>
            <TableHead className="text-right">Monate seit Erhöhung</TableHead>
            <TableHead>Grund</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const loading = generatingPdf === row.mietvertrag_id;
            return (
              <TableRow key={row.mietvertrag_id}>
                <TableCell className="font-medium">{row.mietvertrag_id.slice(0, 8)}…</TableCell>
                <TableCell className="text-right">{formatCurrencyEUR(row.current_kaltmiete)}</TableCell>
                <TableCell>{formatDate(row.letzte_mieterhoehung_am)}</TableCell>
                <TableCell>{formatDate(row.start_datum)}</TableCell>
                <TableCell className="text-right">{row.months_since_last_increase}</TableCell>
                <TableCell className="max-w-[360px] truncate" title={row.reason}>{row.reason}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenContract?.(row.mietvertrag_id)}
                    disabled={!onOpenContract}
                  >
                    Öffnen
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onGeneratePdf(row.mietvertrag_id)}
                    disabled={loading}
                  >
                    {loading ? "Erstelle…" : "PDF erstellen"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
