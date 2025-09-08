import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MietvertragEditableField } from "./MietvertragEditableField";
import { Euro } from "lucide-react";

interface MietvertragKautionSectionProps {
  vertrag: any;
  editingKaution: 'soll' | 'ist' | null;
  onEditKaution: (field: 'soll' | 'ist', value: string) => void;
  onStartEditKaution: (field: 'soll' | 'ist') => void;
  onCancelEditKaution: () => void;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragKautionSection({
  vertrag,
  editingKaution,
  onEditKaution,
  onStartEditKaution,
  onCancelEditKaution,
  formatBetrag
}: MietvertragKautionSectionProps) {
  const kautionSoll = Number(vertrag.kaution_betrag || 0);
  const kautionIst = Number(vertrag.kaution_ist || 0);
  const kautionDifferenz = kautionSoll - kautionIst;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Euro className="h-5 w-5" />
          <span>Kaution Übersicht</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <MietvertragEditableField
              label="Kaution Soll"
              value={kautionSoll}
              isEditing={editingKaution === 'soll'}
              onEdit={() => onStartEditKaution('soll')}
              onSave={(value) => onEditKaution('soll', value)}
              onCancel={onCancelEditKaution}
              type="number"
              className="font-semibold text-blue-800"
              formatter={formatBetrag}
            />
          </div>
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <MietvertragEditableField
              label="Kaution Ist"
              value={kautionIst}
              isEditing={editingKaution === 'ist'}
              onEdit={() => onStartEditKaution('ist')}
              onSave={(value) => onEditKaution('ist', value)}
              onCancel={onCancelEditKaution}
              type="number"
              className="font-semibold text-green-800"
              formatter={formatBetrag}
            />
          </div>
          <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Differenz</p>
              <p className={`text-lg font-semibold ${
                kautionDifferenz > 0 
                  ? 'text-red-600' 
                  : kautionDifferenz < 0 
                    ? 'text-green-600' 
                    : 'text-gray-600'
              }`}>
                {formatBetrag(Math.abs(kautionDifferenz))}
                <span className="text-sm ml-1">
                  {kautionDifferenz > 0 ? 'fehlt' : kautionDifferenz < 0 ? 'zu viel' : 'ausgeglichen'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}