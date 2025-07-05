
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface FehlendeMietzahlungenHeaderProps {
  gesamtFehlend: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const FehlendeMietzahlungenHeader = ({ 
  gesamtFehlend, 
  isOpen, 
  onToggle 
}: FehlendeMietzahlungenHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-4" onClick={onToggle}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="text-left">
          <h3 className="text-lg font-semibold text-gray-800">Fehlende Mietzahlungen</h3>
          <p className="text-sm text-gray-600">Basierend auf Forderungen vs. Zahlungen</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {gesamtFehlend > 0 && (
          <span className="text-lg font-bold text-red-600">
            €{gesamtFehlend.toLocaleString()}
          </span>
        )}
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </div>
    </div>
  );
};
