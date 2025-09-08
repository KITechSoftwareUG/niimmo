import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MietvertragEditableField } from "./MietvertragEditableField";

interface MietvertragContractInfoProps {
  vertrag: any;
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten') => void;
  onCancelEdit: () => void;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragContractInfo({
  vertrag,
  editingMietvertrag,
  onEditMietvertrag,
  onStartEdit,
  onCancelEdit,
  formatDatum,
  formatBetrag
}: MietvertragContractInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mietvertrag Informationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Laufzeit</p>
            <p className="text-lg">
              {vertrag.start_datum ? formatDatum(vertrag.start_datum) : 'N/A'}
              {vertrag.ende_datum ? ` - ${formatDatum(vertrag.ende_datum)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <Badge variant={vertrag.status === 'aktiv' ? 'default' : 'secondary'}>
              {vertrag.status}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <MietvertragEditableField
            label="Kaltmiete"
            value={Number(vertrag.kaltmiete || 0)}
            isEditing={editingMietvertrag === 'kaltmiete'}
            onEdit={() => onStartEdit('kaltmiete')}
            onSave={(value) => onEditMietvertrag('kaltmiete', value)}
            onCancel={onCancelEdit}
            type="number"
            step="0.01"
            className="font-semibold"
            formatter={formatBetrag}
            showLastUpdate={vertrag.letzte_mieterhoehung_am ? formatDatum(vertrag.letzte_mieterhoehung_am) : undefined}
          />
          <MietvertragEditableField
            label="Betriebskosten"
            value={Number(vertrag.betriebskosten || 0)}
            isEditing={editingMietvertrag === 'betriebskosten'}
            onEdit={() => onStartEdit('betriebskosten')}
            onSave={(value) => onEditMietvertrag('betriebskosten', value)}
            onCancel={onCancelEdit}
            type="number"
            step="0.01"
            formatter={formatBetrag}
            showLastUpdate={vertrag.letzte_mieterhoehung_am ? formatDatum(vertrag.letzte_mieterhoehung_am) : undefined}
          />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Gesamtmiete</p>
            <p className="text-lg font-bold text-green-600">
              {formatBetrag(Number(vertrag.kaltmiete || 0) + Number(vertrag.betriebskosten || 0))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}