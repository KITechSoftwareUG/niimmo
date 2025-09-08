import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MietvertragDetail } from "./MietvertragDetail";

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: any;
  immobilie?: any;
}

export default function MietvertragDetailsModal({
  isOpen,
  onClose,
  vertragId,
  einheit,
  immobilie
}: MietvertragDetailsModalProps) {
  console.log("MietvertragDetailsModal - Opening with vertragId:", vertragId);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold">Mietvertrag Details</DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          <MietvertragDetail vertragId={vertragId} onBack={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}