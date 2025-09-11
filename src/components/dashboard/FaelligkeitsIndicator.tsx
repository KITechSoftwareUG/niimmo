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
  
  // Extract the month from sollmonat (e.g., "2025-08" -> August)
  const [year, month] = forderung.sollmonat.split('-');
  const forderungsMonat = parseInt(month);
  const forderungsJahr = parseInt(year);
  
  // Due date is always the 10th of the demand month (use calculated date, not database date)
  const faelligkeitsdatum = new Date(forderungsJahr, forderungsMonat - 1, 10);
  const tagebisFaellig = Math.ceil((faelligkeitsdatum.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check if it's actually due based on calculated date, not just database flag
  const istTatsaechlichFaellig = tagebisFaellig <= 0;

  // Use calculated logic instead of database flag for more accuracy
  if (istTatsaechlichFaellig) {
    const tageFaellig = Math.abs(tagebisFaellig);
    
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

  // This case is now handled above, so this block is removed

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
      <Badge variant="outline" className="flex items-center space-x-1 border-orange-500 text-orange-600">
        <CheckCircle className="h-3 w-3" />
        <span>Offen</span>
      </Badge>
      <span className="text-xs text-gray-500">
        Fällig am 10.{forderungsMonat.toString().padStart(2, '0')}
      </span>
    </div>
  );
};