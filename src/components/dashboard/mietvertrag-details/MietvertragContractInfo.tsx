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
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum' | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum') => void;
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
  
  // Kosten pro m² nur von Kaltmiete berechnen
  const kaltmieteProQm = einheit?.qm && Number(einheit.qm) > 0 
    ? Number(kaltmiete || 0) / Number(einheit.qm) 
    : null;
  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Mietvertrag Informationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <MietvertragEditableField
            label="Mietbeginn"
            value={vertrag.start_datum || ''}
            isEditing={isGlobalEditMode || editingMietvertrag === 'start_datum'}
            onEdit={() => !isGlobalEditMode && onStartEdit('start_datum')}
            onSave={(value) => {
              if (isGlobalEditMode) {
                onUpdateEditedValue?.('start_datum', value);
              } else {
                onEditMietvertrag('start_datum', value);
              }
            }}
            onCancel={onCancelEdit}
            type="date"
            formatter={(val) => formatDatum(val as string)}
            hideEditButton={true}
          />
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground">Mietende</p>
            <p className="text-sm md:text-lg">
              {vertrag.ende_datum ? formatDatum(vertrag.ende_datum) : 'Unbefristet'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
            hideEditButton={true}
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
            hideEditButton={true}
          />
          <div>
            <p className="text-lg font-bold text-green-600">
              {formatBetrag(Number(kaltmiete || 0) + Number(betriebskosten || 0))}
            </p>
          </div>
          {kaltmieteProQm !== null && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Kaltmiete pro m²</p>
              <p className="text-lg font-semibold">
                {formatBetrag(kaltmieteProQm)}
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
                hideEditButton={true}
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
                hideEditButton={true}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}