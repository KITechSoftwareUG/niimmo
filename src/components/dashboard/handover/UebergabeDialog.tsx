import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, KeyRound, ClipboardList, Loader2, Building2, FileDown, Check, RotateCcw, Camera, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignatureCanvas } from "./SignatureCanvas";
import { MeterPhotoUpload } from "./MeterPhotoUpload";
import { NotizenPhotoUpload } from "./NotizenPhotoUpload";
import { UebergabeEmailDialog } from "./UebergabeEmailDialog";

interface ContractInfo {
  id: string;
  einheit: {
    id: string;
    nummer?: string;
    etage?: string;
    immobilie: {
      name: string;
      adresse: string;
    };
  };
  kuendigungsdatum?: string;
}

interface MieterData {
  id: string;
  vorname: string;
  nachname: string | null;
  hauptmail: string | null;
}

interface UebergabeDialogProps {
  isEinzug?: boolean;
  isOpen: boolean;
  onClose: () => void;
  vertragIds: string[];
  contracts: ContractInfo[];
  mieterName?: string;
  onSuccess?: () => void;
}

interface ZaehlerstaendePerContract {
  [contractId: string]: {
    strom: string;
    gas: string;
    wasser: string;
    warmwasser: string;
  };
}

interface MeterPhotosPerContract {
  [contractId: string]: {
    strom?: string;
    gas?: string;
    wasser?: string;
    warmwasser?: string;
  };
}

export const UebergabeDialog = ({
  isOpen,
  onClose,
  vertragIds,
  contracts,
  mieterName,
  onSuccess,
  isEinzug = false,
}: UebergabeDialogProps) => {
  const [uebergabeDatum, setUebergabeDatum] = useState<Date | undefined>(
    contracts[0]?.kuendigungsdatum ? new Date(contracts[0].kuendigungsdatum) : new Date()
  );
  const [schluesselHaustuer, setSchluesselHaustuer] = useState<string>("");
  const [schluesselWohnung, setSchluesselWohnung] = useState<string>("");
  const [schluesselBriefkasten, setSchluesselBriefkasten] = useState<string>("");
  const [schluesselKeller, setSchluesselKeller] = useState<string>("");
  const [zaehlerstaendePerContract, setZaehlerstaendePerContract] = useState<ZaehlerstaendePerContract>(() => {
    const initial: ZaehlerstaendePerContract = {};
    contracts.forEach(c => {
      initial[c.id] = { strom: "", gas: "", wasser: "", warmwasser: "" };
    });
    return initial;
  });
  const [meterPhotosPerContract, setMeterPhotosPerContract] = useState<MeterPhotosPerContract>(() => {
    const initial: MeterPhotosPerContract = {};
    contracts.forEach(c => {
      initial[c.id] = {};
    });
    return initial;
  });
  const [protokollNotizen, setProtokollNotizen] = useState("");
  const [vermieterSignature, setVermieterSignature] = useState<string | null>(null);
  const [mieterSignature, setMieterSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // State for notes photos
  const [notizenPhotos, setNotizenPhotos] = useState<string[]>([]);
  
  // State for email dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  
  // State for tenant data with emails
  const [mieterData, setMieterData] = useState<MieterData[]>([]);
  const [mieterEmails, setMieterEmails] = useState<{ [mieterId: string]: string }>({});

  // Fetch tenant data including emails
  useEffect(() => {
    const fetchMieterData = async () => {
      if (vertragIds.length === 0) return;

      const { data: mieterLinks } = await supabase
        .from("mietvertrag_mieter")
        .select("mieter_id")
        .in("mietvertrag_id", vertragIds);

      if (mieterLinks && mieterLinks.length > 0) {
        const mieterIds = mieterLinks.map((l) => l.mieter_id);
        const { data: mieter } = await supabase
          .from("mieter")
          .select("id, vorname, nachname, hauptmail")
          .in("id", mieterIds);

        if (mieter) {
          setMieterData(mieter);
          const emails: { [key: string]: string } = {};
          mieter.forEach((m) => {
            emails[m.id] = m.hauptmail || "";
          });
          setMieterEmails(emails);
        }
      }
    };

    fetchMieterData();
  }, [vertragIds]);

  const updateZaehlerstand = (contractId: string, field: string, value: string) => {
    setZaehlerstaendePerContract(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [field]: value
      }
    }));
  };

  const updateMeterPhoto = (contractId: string, meterType: string, photoPath: string) => {
    setMeterPhotosPerContract(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [meterType]: photoPath
      }
    }));
  };

  const resetForm = () => {
    setUebergabeDatum(contracts[0]?.kuendigungsdatum ? new Date(contracts[0].kuendigungsdatum) : new Date());
    setSchluesselHaustuer("");
    setSchluesselWohnung("");
    setSchluesselBriefkasten("");
    setSchluesselKeller("");
    const initialZaehler: ZaehlerstaendePerContract = {};
    const initialPhotos: MeterPhotosPerContract = {};
    contracts.forEach(c => {
      initialZaehler[c.id] = { strom: "", gas: "", wasser: "", warmwasser: "" };
      initialPhotos[c.id] = {};
    });
    setZaehlerstaendePerContract(initialZaehler);
    setMeterPhotosPerContract(initialPhotos);
    setProtokollNotizen("");
    setNotizenPhotos([]);
    setVermieterSignature(null);
    setMieterSignature(null);
    setPdfGenerated(false);
  };

  const handleSubmit = async () => {
    if (!uebergabeDatum) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Übergabedatum aus.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      for (const contract of contracts) {
        const zaehlerstaende = zaehlerstaendePerContract[contract.id] || { strom: "", gas: "", wasser: "", warmwasser: "" };
        
        if (isEinzug) {
          const { error: updateError } = await supabase
            .from("mietvertrag")
            .update({
              strom_einzug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
              gas_einzug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
              kaltwasser_einzug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
              warmwasser_einzug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
              start_datum: format(uebergabeDatum, "yyyy-MM-dd"),
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
        } else {
          // Only save meter readings first - status and ende_datum are set after full completion
          const { error: updateError } = await supabase
            .from("mietvertrag")
            .update({
              strom_auszug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
              gas_auszug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
              kaltwasser_auszug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
              warmwasser_auszug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
        }
      }

      // For Auszug: Show email dialog after saving meter readings (status not yet changed)
      if (!isEinzug && mieterData.length > 0) {
        setShowEmailDialog(true);
        return;
      }

      // For Auszug without email dialog: finalize status now
      if (!isEinzug) {
        await finalizeAuszugStatus();
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({
        title: "Fehler",
        description: "Die Übergabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizeAuszugStatus = async () => {
    try {
      for (const contract of contracts) {
        const { error } = await supabase
          .from("mietvertrag")
          .update({ 
            status: "beendet",
            ende_datum: uebergabeDatum ? format(uebergabeDatum, "yyyy-MM-dd") : null,
          })
          .eq("id", contract.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error finalizing contract status:", error);
      toast({
        title: "Fehler",
        description: "Der Vertragsstatus konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleEmailDialogClose = async () => {
    // Finalize contract status to "beendet" after email dialog is closed
    await finalizeAuszugStatus();
    setShowEmailDialog(false);
    onSuccess?.();
    onClose();
  };

  const updateMieterEmail = (mieterId: string, email: string) => {
    setMieterEmails((prev) => ({
      ...prev,
      [mieterId]: email,
    }));
  };

  const handleGeneratePdf = async () => {
    if (!uebergabeDatum) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie erst ein Übergabedatum aus.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const response = await supabase.functions.invoke('generate-uebergabe-pdf', {
        body: {
          mietvertragIds: vertragIds,
          isEinzug,
          uebergabeDatum: format(uebergabeDatum, "yyyy-MM-dd"),
          schluessel: {
            haustuer: schluesselHaustuer,
            wohnung: schluesselWohnung,
            briefkasten: schluesselBriefkasten,
            keller: schluesselKeller
          },
          zaehlerstaendePerContract,
          protokollNotizen,
          notizenPhotos,
          vermieterSignature,
          mieterSignature,
          meterPhotosPerContract
        }
      });

      if (response.error) throw response.error;
      
      const { filePath, fileName } = response.data;
      setPdfGenerated(true);

      toast({
        title: "PDF erstellt",
        description: "Das Übergabeprotokoll wurde erfolgreich erstellt und gespeichert.",
      });

      const { data: downloadData } = await supabase.storage
        .from('dokumente')
        .download(filePath);

      if (downloadData) {
        const url = URL.createObjectURL(downloadData);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Fehler",
        description: "Das PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const content = (
    <div className="space-y-6 p-1">
      {/* Tenant Info */}
      {mieterName && (
        <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Mieter</p>
          <p className="text-sm font-medium">{mieterName}</p>
        </div>
      )}

      {/* Contracts Info */}
      {contracts.length > 1 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium mb-2">
            {contracts.length} verbundene Einheiten werden gemeinsam übergeben:
          </p>
          <ul className="space-y-1">
            {contracts.map(c => (
              <li key={c.id} className="text-xs text-blue-600 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {c.einheit.immobilie.name} - {c.einheit.etage || "–"} / Nr. {c.einheit.nummer || "–"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Übergabedatum */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Übergabedatum *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-12 sm:h-10",
                !uebergabeDatum && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {uebergabeDatum ? (
                format(uebergabeDatum, "PPP", { locale: de })
              ) : (
                <span>Datum auswählen</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={uebergabeDatum}
              onSelect={setUebergabeDatum}
              initialFocus
              locale={de}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Schlüsselübergabe */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Übergebene Schlüssel
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Haustür</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={schluesselHaustuer}
              onChange={(e) => setSchluesselHaustuer(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Wohnung</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={schluesselWohnung}
              onChange={(e) => setSchluesselWohnung(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Briefkasten</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={schluesselBriefkasten}
              onChange={(e) => setSchluesselBriefkasten(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Keller</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={schluesselKeller}
              onChange={(e) => setSchluesselKeller(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </div>

      {/* Zählerstände per Contract with Photo Upload */}
      {contracts.map((contract) => (
        <div key={contract.id} className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            {contracts.length > 1 && (
              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                {contract.einheit.immobilie.name} - {contract.einheit.etage || "–"}
              </span>
            )}
            Zählerstände bei {isEinzug ? "Einzug" : "Auszug"}
          </Label>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Strom */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strom (kWh)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={zaehlerstaendePerContract[contract.id]?.strom || ""}
                  onChange={(e) => updateZaehlerstand(contract.id, "strom", e.target.value)}
                  className="h-10 flex-1"
                />
                <MeterPhotoUpload
                  contractId={contract.id}
                  meterType="strom"
                  isEinzug={isEinzug}
                  onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "strom", path)}
                />
              </div>
            </div>

            {/* Gas */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Gas (m³)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={zaehlerstaendePerContract[contract.id]?.gas || ""}
                  onChange={(e) => updateZaehlerstand(contract.id, "gas", e.target.value)}
                  className="h-10 flex-1"
                />
                <MeterPhotoUpload
                  contractId={contract.id}
                  meterType="gas"
                  isEinzug={isEinzug}
                  onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "gas", path)}
                />
              </div>
            </div>

            {/* Kaltwasser */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kaltwasser (m³)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={zaehlerstaendePerContract[contract.id]?.wasser || ""}
                  onChange={(e) => updateZaehlerstand(contract.id, "wasser", e.target.value)}
                  className="h-10 flex-1"
                />
                <MeterPhotoUpload
                  contractId={contract.id}
                  meterType="wasser"
                  isEinzug={isEinzug}
                  onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "wasser", path)}
                />
              </div>
            </div>

            {/* Warmwasser */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Warmwasser (m³)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={zaehlerstaendePerContract[contract.id]?.warmwasser || ""}
                  onChange={(e) => updateZaehlerstand(contract.id, "warmwasser", e.target.value)}
                  className="h-10 flex-1"
                />
                <MeterPhotoUpload
                  contractId={contract.id}
                  meterType="warmwasser"
                  isEinzug={isEinzug}
                  onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "warmwasser", path)}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Protokollnotizen */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Übergabeprotokoll Notizen
        </Label>
        
        {/* Photo upload for notes - only for Auszug */}
        {!isEinzug && contracts.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs text-muted-foreground mb-2 block">Fotos (z.B. Mängel, Zustand)</Label>
            <NotizenPhotoUpload
              contractId={contracts[0].id}
              isEinzug={isEinzug}
              onPhotosChange={setNotizenPhotos}
              existingPhotos={notizenPhotos}
            />
          </div>
        )}

        <Textarea
          placeholder="Zustand der Wohnung, Mängel, Besonderheiten..."
          value={protokollNotizen}
          onChange={(e) => setProtokollNotizen(e.target.value)}
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Tenant Emails - only for Auszug */}
      {!isEinzug && mieterData.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail-Adressen der Mieter
          </Label>
          <p className="text-xs text-muted-foreground">
            Diese werden für die Bestätigungsmail nach der Übergabe verwendet.
          </p>
          <div className="space-y-2">
            {mieterData.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    {m.vorname} {m.nachname || ""}
                  </Label>
                  <Input
                    type="email"
                    placeholder="E-Mail-Adresse eingeben..."
                    value={mieterEmails[m.id] || ""}
                    onChange={(e) => updateMieterEmail(m.id, e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digital Signatures */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="text-sm font-semibold text-gray-700">Digitale Unterschriften</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureCanvas
            label="Vermieter / Bevollmächtigter"
            onSignatureChange={setVermieterSignature}
          />
          <SignatureCanvas
            label="Mieter"
            onSignatureChange={setMieterSignature}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4 border-t">
        {/* PDF Export Button */}
        <Button
          variant="outline"
          onClick={handleGeneratePdf}
          className="w-full h-12 sm:h-10 border-dashed"
          disabled={isGeneratingPdf || isSubmitting}
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              PDF wird erstellt...
            </>
          ) : pdfGenerated ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-600" />
              PDF erstellt & heruntergeladen
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Übergabeprotokoll als PDF speichern
            </>
          )}
        </Button>

        {/* Reset Button */}
        <Button
          variant="ghost"
          onClick={resetForm}
          className="w-full h-10 text-gray-500"
          disabled={isSubmitting || isGeneratingPdf}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Formular zurücksetzen (Neues Protokoll)
        </Button>

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto h-12 sm:h-10"
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            className="w-full sm:flex-1 h-12 sm:h-10"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              contracts.length > 1 
                ? `${contracts.length} Übergaben abschließen` 
                : "Übergabe abschließen"
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const dialogTitle = isEinzug ? "Übergabe (Einzug)" : "Übergabe (Auszug)";
  const DialogIcon = KeyRound;

  // Email dialog for post-handover
  const emailDialogComponent = showEmailDialog && uebergabeDatum && (
    <UebergabeEmailDialog
      isOpen={showEmailDialog}
      onClose={handleEmailDialogClose}
      mieter={mieterData.map((m) => ({
        ...m,
        hauptmail: mieterEmails[m.id] || m.hauptmail,
      }))}
      contracts={contracts}
      uebergabeDatum={uebergabeDatum}
      mieterName={mieterName || ""}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        {emailDialogComponent}
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
              {dialogTitle}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {emailDialogComponent}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
