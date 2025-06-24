
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface MietvertragHeaderProps {
  onBack: () => void;
  status?: string;
}

export const MietvertragHeader = ({ onBack, status }: MietvertragHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Zurück
      </Button>
      <Badge variant={status === 'aktiv' ? 'default' : 'secondary'}>
        {status}
      </Badge>
    </div>
  );
};
