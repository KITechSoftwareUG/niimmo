import { MietvertragContractInfo } from "./MietvertragContractInfo";
import { MietvertragTenantInfo } from "./MietvertragTenantInfo";
import { MietvertragKautionSection } from "./MietvertragKautionSection";
import { MietvertragPaymentsSection } from "./MietvertragPaymentsSection";

interface MietvertragOverviewTabProps {
  vertrag: any;
  mieter: any[];
  forderungen: any[];
  zahlungen: any[];
  immobilie?: any;
  einheit?: any;
  editingMietvertrag: 'kaltmiete' | 'betriebskosten' | null;
  editingKaution: 'soll' | 'ist' | null;
  onEditMietvertrag: (field: 'kaltmiete' | 'betriebskosten', value: string) => void;
  onStartEdit: (field: 'kaltmiete' | 'betriebskosten') => void;
  onCancelEdit: () => void;
  onEditKaution: (field: 'soll' | 'ist', value: string) => void;
  onStartEditKaution: (field: 'soll' | 'ist') => void;
  onCancelEditKaution: () => void;
  onCreateForderung: () => void;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragOverviewTab({
  vertrag,
  mieter,
  forderungen,
  zahlungen,
  immobilie,
  einheit,
  editingMietvertrag,
  editingKaution,
  onEditMietvertrag,
  onStartEdit,
  onCancelEdit,
  onEditKaution,
  onStartEditKaution,
  onCancelEditKaution,
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

      {/* Payments Section */}
      <MietvertragPaymentsSection
        vertrag={vertrag}
        forderungen={forderungen}
        zahlungen={zahlungen}
        formatBetrag={formatBetrag}
        onCreateForderung={onCreateForderung}
      />
    </div>
  );
}