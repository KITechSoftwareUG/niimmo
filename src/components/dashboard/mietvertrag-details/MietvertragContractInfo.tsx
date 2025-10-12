import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MietvertragEditableField } from "./MietvertragEditableField";

interface MietvertragContractInfoProps {
  vertrag: any;
  einheit?: any;
  isGlobalEditMode?: boolean;
  editedValues?: Record<string, any>;
  onUpdateEditedValue?: (key: string, value: any) => void;
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr') => void;
  onCancelEdit: () => void;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragContractInfo({
  vertrag,
  einheit,
  isGlobalEditMode = false,
  editedValues = {},
  onUpdateEditedValue,
  editingMietvertrag,
  onEditMietvertrag,
  onStartEdit,
  onCancelEdit,
  formatDatum,
  formatBetrag
}: MietvertragContractInfoProps) {
  const kaltmiete = isGlobalEditMode && editedValues.kaltmiete !== undefined ? editedValues.kaltmiete : vertrag.kaltmiete;
  const betriebskosten = isGlobalEditMode && editedValues.betriebskosten !== undefined ? editedValues.betriebskosten : vertrag.betriebskosten;
  
  const gesamtmieteProQm = einheit?.qm && Number(einheit.qm) > 0 
    ? (Number(kaltmiete || 0) + Number(betriebskosten || 0)) / Number(einheit.qm) 
    : null;
  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Mietvertrag Informationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground">Laufzeit</p>
            <p className="text-sm md:text-lg">
              {vertrag.start_datum ? formatDatum(vertrag.start_datum) : 'N/A'}
              {vertrag.ende_datum ? ` - ${formatDatum(vertrag.ende_datum)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground">Status</p>
            <Badge variant={vertrag.status === 'aktiv' ? 'default' : 'secondary'} className="text-xs">
              {vertrag.status}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <MietvertragEditableField
            label="Kaltmiete"
            value={Number(kaltmiete || 0)}
            isEditing={isGlobalEditMode || editingMietvertrag === 'kaltmiete'}
            onEdit={() => !isGlobalEditMode && onStartEdit('kaltmiete')}
            onSave={(value) => {
              if (isGlobalEditMode) {
                onUpdateEditedValue?.('kaltmiete', parseFloat(value));
              } else {
                onEditMietvertrag('kaltmiete', value);
              }
            }}
            onCancel={onCancelEdit}
            type="number"
            step="0.01"
            className="font-semibold"
            formatter={formatBetrag}
            showLastUpdate={vertrag.letzte_mieterhoehung_am ? formatDatum(vertrag.letzte_mieterhoehung_am) : undefined}
            hideEditButton={isGlobalEditMode}
          />
          <MietvertragEditableField
            label="Betriebskosten"
            value={Number(betriebskosten || 0)}
            isEditing={isGlobalEditMode || editingMietvertrag === 'betriebskosten'}
            onEdit={() => !isGlobalEditMode && onStartEdit('betriebskosten')}
            onSave={(value) => {
              if (isGlobalEditMode) {
                onUpdateEditedValue?.('betriebskosten', parseFloat(value));
              } else {
                onEditMietvertrag('betriebskosten', value);
              }
            }}
            onCancel={onCancelEdit}
            type="number"
            step="0.01"
            formatter={formatBetrag}
            showLastUpdate={vertrag.letzte_mieterhoehung_am ? formatDatum(vertrag.letzte_mieterhoehung_am) : undefined}
            hideEditButton={isGlobalEditMode}
          />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Gesamtmiete</p>
            <p className="text-lg font-bold text-green-600">
              {formatBetrag(Number(kaltmiete || 0) + Number(betriebskosten || 0))}
            </p>
          </div>
          {gesamtmieteProQm !== null && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Kosten pro m²</p>
              <p className="text-lg font-semibold">
                {formatBetrag(gesamtmieteProQm)}
              </p>
            </div>
          )}
        </div>
        
        {/* Show Rücklastschrift-Gebühr only for contracts with Lastschrift */}
        {vertrag.lastschrift && (
          <>
            <Separator />
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              <MietvertragEditableField
                label="Rücklastschrift-Gebühr"
                value={Number(vertrag.ruecklastschrift_gebuehr || 7.50)}
                isEditing={editingMietvertrag === 'ruecklastschrift_gebuehr'}
                onEdit={() => onStartEdit('ruecklastschrift_gebuehr')}
                onSave={(value) => onEditMietvertrag('ruecklastschrift_gebuehr', value)}
                onCancel={onCancelEdit}
                type="number"
                step="0.01"
                formatter={formatBetrag}
              />
            </div>
          </>
        )}
        
        {/* Show neue_anschrift field only for terminated or ended contracts */}
        {(vertrag.status === 'beendet' || vertrag.status === 'gekuendigt') && (
          <>
            <Separator />
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              <MietvertragEditableField
                label="Neue Anschrift"
                value={vertrag.neue_anschrift || ''}
                isEditing={editingMietvertrag === 'neue_anschrift'}
                onEdit={() => onStartEdit('neue_anschrift')}
                onSave={(value) => onEditMietvertrag('neue_anschrift', value)}
                onCancel={onCancelEdit}
                type="textarea"
                className="text-muted-foreground"
                placeholder="Straße und Hausnummer&#10;Postleitzahl Ort&#10;z.B. Musterstraße 123&#10;12345 Musterstadt"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}