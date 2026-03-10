import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, KeyRound, ClipboardList, Loader2, Building2, FileDown, Check, RotateCcw, Mail, Eye, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignatureCanvas } from "./SignatureCanvas";
import { MeterPhotoUpload } from "./MeterPhotoUpload";
import { NotizenPhotoUpload } from "./NotizenPhotoUpload";
import { UebergabeEmailDialog } from "./UebergabeEmailDialog";
import { generateUebergabePdf, type UebergabePdfData } from "@/utils/uebergabePdfGenerator";

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
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Notes photos
  const [notizenPhotos, setNotizenPhotos] = useState<string[]>([]);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Email dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  
  // Confirmation dialog
  const [showConfirmFinalize, setShowConfirmFinalize] = useState(false);
  
  // Tenant data
  const [mieterData, setMieterData] = useState<MieterData[]>([]);
  const [mieterEmails, setMieterEmails] = useState<{ [mieterId: string]: string }>({});

  // Fetch tenant data
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

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const updateZaehlerstand = (contractId: string, field: string, value: string) => {
    setZaehlerstaendePerContract(prev => ({
      ...prev,
      [contractId]: { ...prev[contractId], [field]: value }
    }));
  };

  const updateMeterPhoto = (contractId: string, meterType: string, photoPath: string) => {
    setMeterPhotosPerContract(prev => ({
      ...prev,
      [contractId]: { ...prev[contractId], [meterType]: photoPath }
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
    setShowPreview(false);
    setPdfBlobUrl(null);
    setPdfBlob(null);
  };

  const buildPdfData = useCallback((): UebergabePdfData | null => {
    if (!uebergabeDatum) return null;
    return {
      isEinzug,
      uebergabeDatum: format(uebergabeDatum, "dd.MM.yyyy", { locale: de }),
      mieterName: mieterName || "–",
      immobilieName: contracts[0]?.einheit?.immobilie?.name || "",
      immobilieAdresse: contracts[0]?.einheit?.immobilie?.adresse || "",
      schluessel: {
        haustuer: schluesselHaustuer,
        wohnung: schluesselWohnung,
        briefkasten: schluesselBriefkasten,
        keller: schluesselKeller,
      },
      einheiten: contracts.map(c => ({
        name: c.einheit.immobilie.name,
        adresse: c.einheit.immobilie.adresse,
        etage: c.einheit.etage || "",
        qm: null,
        zaehlerstaende: zaehlerstaendePerContract[c.id] || { strom: "", gas: "", wasser: "", warmwasser: "" },
      })),
      protokollNotizen,
      vermieterSignature,
      mieterSignature,
    };
  }, [uebergabeDatum, isEinzug, mieterName, contracts, schluesselHaustuer, schluesselWohnung, schluesselBriefkasten, schluesselKeller, zaehlerstaendePerContract, protokollNotizen, vermieterSignature, mieterSignature]);

  const handleGeneratePreview = async () => {
    const pdfData = buildPdfData();
    if (!pdfData) {
      toast({ title: "Fehler", description: "Bitte wählen Sie ein Übergabedatum aus.", variant: "destructive" });
      return;
    }
    setIsGeneratingPreview(true);
    try {
      const blob = await generateUebergabePdf(pdfData);
      setPdfBlob(blob);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(URL.createObjectURL(blob));
      setShowPreview(true);
    } catch (error) {
      console.error("Error generating preview:", error);
      toast({ title: "Fehler", description: "PDF-Vorschau konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const datumStr = uebergabeDatum ? format(uebergabeDatum, "dd-MM-yyyy") : "datum";
    const fileName = `Uebergabeprotokoll_${isEinzug ? "Einzug" : "Auszug"}_${mieterName?.replace(/\s+/g, "_") || "Mieter"}_${datumStr}.pdf`;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getPdfFileName = () => {
    const datumStr = uebergabeDatum ? format(uebergabeDatum, "dd-MM-yyyy") : "datum";
    return `Uebergabeprotokoll_${isEinzug ? "Einzug" : "Auszug"}_${mieterName?.replace(/\s+/g, "_") || "Mieter"}_${datumStr}.pdf`;
  };

  const handleSubmit = async () => {
    if (!uebergabeDatum) {
      toast({ title: "Fehler", description: "Bitte wählen Sie ein Übergabedatum aus.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      for (const contract of contracts) {
        const zaehlerstaende = zaehlerstaendePerContract[contract.id] || { strom: "", gas: "", wasser: "", warmwasser: "" };
        if (isEinzug) {
          await supabase.from("mietvertrag").update({
            strom_einzug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
            gas_einzug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
            kaltwasser_einzug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
            warmwasser_einzug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
          }).eq("id", contract.id);
        } else {
          await supabase.from("mietvertrag").update({
            strom_auszug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
            gas_auszug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
            kaltwasser_auszug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
            warmwasser_auszug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
          }).eq("id", contract.id);
        }
      }
      // Show email dialog if we have tenants
      if (mieterData.length > 0) {
        setShowEmailDialog(true);
        return;
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({ title: "Fehler", description: "Die Übergabe konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailDialogClose = async () => {
    setShowEmailDialog(false);
    onSuccess?.();
    onClose();
  };

  const updateMieterEmail = (mieterId: string, email: string) => {
    setMieterEmails((prev) => ({ ...prev, [mieterId]: email }));
  };

  // ============ FORM CONTENT ============
  const formContent = (
    <div className="space-y-6 p-1">
      {mieterName && (
        <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Mieter</p>
          <p className="text-sm font-medium">{mieterName}</p>
        </div>
      )}

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
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-12 sm:h-10", !uebergabeDatum && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {uebergabeDatum ? format(uebergabeDatum, "PPP", { locale: de }) : <span>Datum auswählen</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={uebergabeDatum} onSelect={setUebergabeDatum} initialFocus locale={de} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Schlüssel */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Übergebene Schlüssel
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Haustür</Label>
            <Input type="number" placeholder="0" min="0" value={schluesselHaustuer} onChange={(e) => setSchluesselHaustuer(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Wohnung</Label>
            <Input type="number" placeholder="0" min="0" value={schluesselWohnung} onChange={(e) => setSchluesselWohnung(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Briefkasten</Label>
            <Input type="number" placeholder="0" min="0" value={schluesselBriefkasten} onChange={(e) => setSchluesselBriefkasten(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Keller</Label>
            <Input type="number" placeholder="0" min="0" value={schluesselKeller} onChange={(e) => setSchluesselKeller(e.target.value)} className="h-10" />
          </div>
        </div>
      </div>

      {/* Zählerstände per Contract */}
      {contracts.map((contract) => (
        <div key={contract.id} className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            {contracts.length > 1 && (
              <span className="bg-muted px-2 py-0.5 rounded text-xs">
                {contract.einheit.immobilie.name} - {contract.einheit.etage || "–"}
              </span>
            )}
            Zählerstände bei {isEinzug ? "Einzug" : "Auszug"}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strom (kWh)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="0" value={zaehlerstaendePerContract[contract.id]?.strom || ""} onChange={(e) => updateZaehlerstand(contract.id, "strom", e.target.value)} className="h-10 flex-1" />
                <MeterPhotoUpload contractId={contract.id} meterType="strom" isEinzug={isEinzug} onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "strom", path)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Gas (m³)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="0" value={zaehlerstaendePerContract[contract.id]?.gas || ""} onChange={(e) => updateZaehlerstand(contract.id, "gas", e.target.value)} className="h-10 flex-1" />
                <MeterPhotoUpload contractId={contract.id} meterType="gas" isEinzug={isEinzug} onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "gas", path)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kaltwasser (m³)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="0" value={zaehlerstaendePerContract[contract.id]?.wasser || ""} onChange={(e) => updateZaehlerstand(contract.id, "wasser", e.target.value)} className="h-10 flex-1" />
                <MeterPhotoUpload contractId={contract.id} meterType="wasser" isEinzug={isEinzug} onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "wasser", path)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Warmwasser (m³)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="0" value={zaehlerstaendePerContract[contract.id]?.warmwasser || ""} onChange={(e) => updateZaehlerstand(contract.id, "warmwasser", e.target.value)} className="h-10 flex-1" />
                <MeterPhotoUpload contractId={contract.id} meterType="warmwasser" isEinzug={isEinzug} onPhotoUploaded={(path) => updateMeterPhoto(contract.id, "warmwasser", path)} />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Notizen */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Übergabeprotokoll Notizen
        </Label>
        {!isEinzug && contracts.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs text-muted-foreground mb-2 block">Fotos (z.B. Mängel, Zustand)</Label>
            <NotizenPhotoUpload contractId={contracts[0].id} isEinzug={isEinzug} onPhotosChange={setNotizenPhotos} existingPhotos={notizenPhotos} />
          </div>
        )}
        <Textarea placeholder="Zustand der Wohnung, Mängel, Besonderheiten..." value={protokollNotizen} onChange={(e) => setProtokollNotizen(e.target.value)} className="min-h-[100px] resize-none" />
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
                  <Label className="text-xs text-muted-foreground">{m.vorname} {m.nachname || ""}</Label>
                  <Input type="email" placeholder="E-Mail-Adresse eingeben..." value={mieterEmails[m.id] || ""} onChange={(e) => updateMieterEmail(m.id, e.target.value)} className="h-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="text-sm font-semibold">Digitale Unterschriften</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureCanvas label="Vermieter / Bevollmächtigter" onSignatureChange={setVermieterSignature} />
          <SignatureCanvas label="Mieter" onSignatureChange={setMieterSignature} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4 border-t">
        {/* Preview Button - only way to proceed */}
        <Button onClick={handleGeneratePreview} className="w-full h-12 sm:h-10" disabled={isGeneratingPreview || isSubmitting}>
          {isGeneratingPreview ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vorschau wird erstellt...</>
          ) : (
            <><Eye className="mr-2 h-4 w-4" />Vorschau & Prüfen</>
          )}
        </Button>

        <Button variant="ghost" onClick={resetForm} className="w-full h-10 text-muted-foreground" disabled={isSubmitting || isGeneratingPreview}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Formular zurücksetzen
        </Button>

        <Button variant="outline" onClick={onClose} className="w-full h-12 sm:h-10" disabled={isSubmitting}>
          Abbrechen
        </Button>
      </div>
    </div>
  );

  // ============ PREVIEW CONTENT ============
  const previewContent = (
    <div className="flex flex-col h-full">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b mb-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
          ← Zurück zur Bearbeitung
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!pdfBlobUrl}>
            <FileDown className="mr-1 h-4 w-4" />
            Download
          </Button>
          <Button size="sm" onClick={() => setShowConfirmFinalize(true)} disabled={isSubmitting}>
            <Send className="mr-1 h-4 w-4" />
            Abschließen & Senden
          </Button>
        </div>
      </div>
      {/* PDF Preview */}
      {pdfBlobUrl && (
        <iframe
          src={pdfBlobUrl}
          className="w-full flex-1 min-h-[500px] rounded-lg border"
          title="Übergabeprotokoll Vorschau"
        />
      )}
    </div>
  );

  const dialogTitle = isEinzug ? "Übergabe (Einzug)" : "Übergabe (Auszug)";
  const DialogIcon = KeyRound;

  // Email dialog
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
      pdfBlob={pdfBlob}
      pdfFileName={getPdfFileName()}
    />
  );

  const confirmDialog = (
    <AlertDialog open={showConfirmFinalize} onOpenChange={setShowConfirmFinalize}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Übergabe abschließen?</AlertDialogTitle>
          <AlertDialogDescription>
            Zählerstände werden gespeichert und das Übergabeprotokoll wird abgeschlossen. 
            Bitte stellen Sie sicher, dass alle Angaben korrekt sind.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit}>
            Bestätigen & Abschließen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        {confirmDialog}
        {emailDialogComponent}
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
              {dialogTitle}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {showPreview ? previewContent : formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {confirmDialog}
      {emailDialogComponent}
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        showPreview ? "sm:max-w-[1100px]" : "sm:max-w-[900px]"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
            {dialogTitle}
            {showPreview && <span className="text-xs font-normal text-muted-foreground ml-2">— Vorschau</span>}
          </DialogTitle>
        </DialogHeader>
        {showPreview ? previewContent : formContent}
      </DialogContent>
    </Dialog>
  );
};
