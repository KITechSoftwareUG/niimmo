import { MietvertragContractInfo } from "./MietvertragContractInfo";
import { MietvertragTenantInfo } from "./MietvertragTenantInfo";
import { MietvertragKautionSection } from "./MietvertragKautionSection";
import { MietvertragPaymentsSection } from "./MietvertragPaymentsSection";
import { MietvertragMeterReadings } from "./MietvertragMeterReadings";

interface MietvertragOverviewTabProps {
  vertrag: any;
  mieter: any[];
  forderungen: any[];
  zahlungen: any[];
  allMietvertraege?: any[];
  vertragId: string;
  immobilie?: any;
  einheit?: any;
  isGlobalEditMode?: boolean;
  editedValues?: Record<string, any>;
  onUpdateEditedValue?: (key: string, value: any) => void;
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum' | 'ende_datum' | 'anzahl_personen' | null;
  editingKaution: 'soll' | 'ist' | null;
  editingMeter: string | null;
  editingMeterNumber: string | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum' | 'ende_datum' | 'anzahl_personen', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum' | 'ende_datum' | 'anzahl_personen') => void;
  onCancelEdit: () => void;
  onEditKaution: (field: 'soll' | 'ist', value: string) => void;
  onStartEditKaution: (field: 'soll' | 'ist') => void;
  onCancelEditKaution: () => void;
  onEditMeter: (field: string, value: string) => void;
  onStartEditMeter: (field: string) => void;
  onCancelEditMeter: () => void;
  onEditMeterNumber: (field: string, value: string) => void;
  onStartEditMeterNumber: (field: string) => void;
  onCancelEditMeterNumber: () => void;
  onCreateForderung: () => void;
  onContractUpdate?: () => void;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragOverviewTab({
  vertrag,
  mieter,
  forderungen,
  zahlungen,
  allMietvertraege,
  vertragId,
  immobilie,
  einheit,
  isGlobalEditMode = false,
  editedValues = {},
  onUpdateEditedValue,
  editingMietvertrag,
  editingKaution,
  editingMeter,
  editingMeterNumber,
  onEditMietvertrag,
  onStartEdit,
  onCancelEdit,
  onEditKaution,
  onStartEditKaution,
  onCancelEditKaution,
  onEditMeter,
  onStartEditMeter,
  onCancelEditMeter,
  onEditMeterNumber,
  onStartEditMeterNumber,
  onCancelEditMeterNumber,
  onCreateForderung,
  onContractUpdate,
  formatDatum,
  formatBetrag
}: MietvertragOverviewTabProps) {
  return (
    <div className="space-y-3 md:space-y-4">
      {/* Contract and Tenant Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        <MietvertragContractInfo
          vertrag={vertrag}
          einheit={einheit}
          isGlobalEditMode={isGlobalEditMode}
          editedValues={editedValues}
          onUpdateEditedValue={onUpdateEditedValue}
          editingMietvertrag={editingMietvertrag}
          onEditMietvertrag={onEditMietvertrag}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          formatDatum={formatDatum}
          formatBetrag={formatBetrag}
        />
        <MietvertragTenantInfo
          mieter={mieter}
          immobilie={immobilie}
          einheit={einheit}
          isGlobalEditMode={isGlobalEditMode}
          editedValues={editedValues}
          onUpdateEditedValue={onUpdateEditedValue}
        />
      </div>

      {/* Kaution Section */}
      <MietvertragKautionSection
        vertrag={vertrag}
        isGlobalEditMode={isGlobalEditMode}
        editedValues={editedValues}
        onUpdateEditedValue={onUpdateEditedValue}
        editingKaution={editingKaution}
        onEditKaution={onEditKaution}
        onStartEditKaution={onStartEditKaution}
        onCancelEditKaution={onCancelEditKaution}
        formatBetrag={formatBetrag}
      />

      {/* Meter Readings Section */}
      <MietvertragMeterReadings
        vertrag={vertrag}
        einheit={einheit}
        isGlobalEditMode={isGlobalEditMode}
        editedValues={editedValues}
        onUpdateEditedValue={onUpdateEditedValue}
        editingMeter={editingMeter}
        editingMeterNumber={editingMeterNumber}
        onEditMeter={onEditMeter}
        onStartEditMeter={onStartEditMeter}
        onCancelEditMeter={onCancelEditMeter}
        onEditMeterNumber={onEditMeterNumber}
        onStartEditMeterNumber={onStartEditMeterNumber}
        onCancelEditMeterNumber={onCancelEditMeterNumber}
      />

      {/* Payments Section */}
      <MietvertragPaymentsSection
        vertrag={vertrag}
        forderungen={forderungen}
        zahlungen={zahlungen}
        allMietvertraege={allMietvertraege}
        vertragId={vertragId}
        mieterIds={mieter?.map((m: any) => m.id).filter(Boolean) || []}
        einheit={einheit}
        immobilie={immobilie}
        formatBetrag={formatBetrag}
        formatDatum={formatDatum}
        onCreateForderung={onCreateForderung}
        onContractUpdate={onContractUpdate}
      />
    </div>
  );
}