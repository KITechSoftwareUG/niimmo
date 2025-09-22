import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualTerminationForm } from "./ManualTerminationForm";
import { DocumentUploadTermination } from "./DocumentUploadTermination";
import { FileText, Upload } from "lucide-react";

interface TerminationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: {
    id: string;
    nummer?: string;
    etage?: string;
  };
  immobilie?: {
    name: string;
    adresse: string;
  };
  onTerminationSuccess?: () => void;
}

export const TerminationDialog = ({
  isOpen,
  onClose,
  vertragId,
  einheit,
  immobilie,
  onTerminationSuccess
}: TerminationDialogProps) => {
  const handleSuccess = () => {
    onClose();
    onTerminationSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-destructive" />
            Mietvertrag kündigen
          </DialogTitle>
          {einheit && (
            <p className="text-sm text-muted-foreground">
              {immobilie?.name} - Einheit {einheit.nummer || einheit.id}
              {einheit.etage && ` (${einheit.etage})`}
            </p>
          )}
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manuelle Eingabe
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Dokument Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <ManualTerminationForm
              vertragId={vertragId}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <DocumentUploadTermination
              vertragId={vertragId}
              einheitId={einheit?.id}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};