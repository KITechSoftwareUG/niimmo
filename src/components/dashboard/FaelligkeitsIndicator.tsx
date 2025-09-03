import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

interface FaelligkeitsIndicatorProps {
  forderung: {
    ist_faellig: boolean;
    faelligkeitsdatum: string;
    faellig_seit?: string;
    sollmonat: string;
  };
}

export const FaelligkeitsIndicator = ({ forderung }: FaelligkeitsIndicatorProps) => {
  const heute = new Date();
  // Parse date safely to avoid timezone issues
  const dateString = forderung.faelligkeitsdatum.split('T')[0]; // Extract just the date part
  const [year, month, day] = dateString.split('-').map(Number);
  const faelligkeitsdatum = new Date(year, month - 1, day); // month is 0-indexed
  const tagebisFaellig = Math.ceil((faelligkeitsdatum.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24));

  if (forderung.ist_faellig) {
    const faelligSeit = forderung.faellig_seit ? new Date(forderung.faellig_seit) : faelligkeitsdatum;
    const tageFaellig = Math.ceil((heute.getTime() - faelligSeit.getTime()) / (1000 * 60 * 60 * 24));
    
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="destructive" className="flex items-center space-x-1">
          <AlertCircle className="h-3 w-3" />
          <span>Fällig</span>
        </Badge>
        <span className="text-xs text-red-600">
          {tageFaellig === 0 ? 'Heute fällig geworden' : `${tageFaellig} Tag${tageFaellig !== 1 ? 'e' : ''} überfällig`}
        </span>
      </div>
    );
  }

  if (tagebisFaellig <= 0) {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="flex items-center space-x-1 border-orange-500 text-orange-600">
          <Clock className="h-3 w-3" />
          <span>Wird heute fällig</span>
        </Badge>
      </div>
    );
  }

  if (tagebisFaellig <= 3) {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="flex items-center space-x-1 border-yellow-500 text-yellow-600">
          <Clock className="h-3 w-3" />
          <span>Bald fällig</span>
        </Badge>
        <span className="text-xs text-yellow-600">
          {tagebisFaellig} Tag{tagebisFaellig !== 1 ? 'e' : ''} bis Fälligkeit
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="outline" className="flex items-center space-x-1 border-green-500 text-green-600">
        <CheckCircle className="h-3 w-3" />
        <span>Noch nicht fällig</span>
      </Badge>
      <span className="text-xs text-gray-500">
        Fällig am {faelligkeitsdatum.toLocaleDateString('de-DE')}
      </span>
    </div>
  );
};