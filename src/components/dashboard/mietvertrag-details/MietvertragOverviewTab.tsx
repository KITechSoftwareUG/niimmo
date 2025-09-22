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
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | null;
  editingKaution: 'soll' | 'ist' | null;
  editingMeter: string | null;
  editingMeterNumber: string | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr') => void;
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
  formatDatum,
  formatBetrag
}: MietvertragOverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Contract and Tenant Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MietvertragContractInfo
          vertrag={vertrag}
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
        />
      </div>

      {/* Kaution Section */}
      <MietvertragKautionSection
        vertrag={vertrag}
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
        formatBetrag={formatBetrag}
        formatDatum={formatDatum}
        onCreateForderung={onCreateForderung}
      />
    </div>
  );
}