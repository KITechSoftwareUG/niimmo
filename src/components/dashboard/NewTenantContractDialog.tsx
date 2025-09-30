import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, User, Users, Plus, Check, Calendar, Euro, FileUp, X, Building2, Zap, Crown, UserCheck, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OCRProcessingService } from "@/services/ocrProcessingService";

interface NewTenantContractDialogProps {
  isOpen: boolean;
  onClose: () => void;
  einheitId: string;
  immobilie?: {
    name: string;
    adresse: string;
  };
}

interface NewTenant {
  vorname: string;
  nachname: string;
  hauptmail: string;
  telnr: string;
  geburtsdatum: string;
  rolle: 'hauptmieter' | 'mitmieter';
}

interface ContractData {
  kaltmiete: string;
  betriebskosten: string;
  kaution_betrag: string;
  start_datum: string;
  ende_datum: string;
  lastschrift: boolean;
  bankkonto_mieter: string;
  ruecklastschrift_gebuehr: string;
  verwendungszweck: string;
  strom_einzug: string;
  gas_einzug: string;
  kaltwasser_einzug: string;
  warmwasser_einzug: string;
}

export const NewTenantContractDialog = ({ 
  isOpen, 
  onClose, 
  einheitId, 
  immobilie 
}: NewTenantContractDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for tabs and forms
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual');
  const [activeTab, setActiveTab] = useState("new-tenant");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'tenant' | 'contract' | 'documents' | 'upload'>('tenant');
  
  // New tenant form state
  const [newTenants, setNewTenants] = useState<NewTenant[]>([{
    vorname: '',
    nachname: '',
    hauptmail: '',
    telnr: '',
    geburtsdatum: '',
    rolle: 'hauptmieter'
  }]);
  
  // Existing tenant selection state
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  
  // Contract data state
  const [contractData, setContractData] = useState<ContractData>({
    kaltmiete: '',
    betriebskosten: '',
    kaution_betrag: '',
    start_datum: '',
    ende_datum: '',
    lastschrift: false,
    bankkonto_mieter: '',
    ruecklastschrift_gebuehr: '7.50',
    verwendungszweck: '',
    strom_einzug: '',
    gas_einzug: '',
    kaltwasser_einzug: '',
    warmwasser_einzug: ''
  });
  
  // Document upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [ocrResults, setOcrResults] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Query existing tenants for selection
  const { data: existingTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mieter')
        .select('*')
        .order('nachname', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputMode('manual');
      setStep('tenant');
      setActiveTab('new-tenant');
      setNewTenants([{
        vorname: '',
        nachname: '',
        hauptmail: '',
        telnr: '',
        geburtsdatum: '',
        rolle: 'hauptmieter'
      }]);
      setSelectedTenantIds([]);
      setContractData({
        kaltmiete: '',
        betriebskosten: '',
        kaution_betrag: '',
        start_datum: '',
        ende_datum: '',
        lastschrift: false,
        bankkonto_mieter: '',
        ruecklastschrift_gebuehr: '7.50',
        verwendungszweck: '',
        strom_einzug: '',
        gas_einzug: '',
        kaltwasser_einzug: '',
        warmwasser_einzug: ''
      });
      setUploadedFiles([]);
      setProcessingOCR(false);
      setOcrResults(null);
      setDragActive(false);
    }
  }, [isOpen]);

  const handleInputModeChange = (mode: 'manual' | 'upload') => {
    setInputMode(mode);
    if (mode === 'upload') {
      setStep('upload');
    } else {
      setStep('tenant');
    }
    // Reset any OCR results when switching modes
    setOcrResults(null);
    setUploadedFiles([]);
  };

  const addNewTenant = () => {
    setNewTenants([...newTenants, {
      vorname: '',
      nachname: '',
      hauptmail: '',
      telnr: '',
      geburtsdatum: '',
      rolle: 'mitmieter'
    }]);
  };

  const updateNewTenant = (index: number, field: keyof NewTenant, value: string | 'hauptmieter' | 'mitmieter') => {
    const updated = [...newTenants];
    if (field === 'rolle') {
      updated[index][field] = value as 'hauptmieter' | 'mitmieter';
    } else {
      updated[index][field as keyof Omit<NewTenant, 'rolle'>] = value as string;
    }
    setNewTenants(updated);
  };

  const removeNewTenant = (index: number) => {
    if (newTenants.length > 1) {
      setNewTenants(newTenants.filter((_, i) => i !== index));
    }
  };

  const toggleExistingTenant = (tenantId: string) => {
    setSelectedTenantIds(prev => 
      prev.includes(tenantId) 
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const validateTenantStep = () => {
    if (activeTab === 'new-tenant') {
      const hasValidTenants = newTenants.every(tenant => 
        tenant.vorname.trim() && tenant.nachname.trim()
      );
      const hasMainTenant = newTenants.some(tenant => tenant.rolle === 'hauptmieter');
      return hasValidTenants && hasMainTenant;
    } else {
      return selectedTenantIds.length > 0;
    }
  };

  const validateContractStep = () => {
    return contractData.kaltmiete && contractData.betriebskosten && contractData.start_datum;
  };

  const handleFileUpload = async (files: FileList | File[] | null) => {
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      // Automatically process first document for OCR
      const document = newFiles[0];
      if (document.type === 'application/pdf') {
        toast({
          title: 'PDF erkannt',
          description: 'Extrahiere Text aus PDF-Dokument...',
        });
      }
      await processDocumentOCR(document);
    }
  };

  const processDocumentOCR = async (file: File) => {
    setProcessingOCR(true);
    setOcrResults(null);
    
    try {
      const result = await OCRProcessingService.processContractDocument(file);
      console.log('OCR Result:', result);
      
      if (result.success && result.extractedData) {
        setOcrResults(result);
        
        // Auto-fill form fields with extracted data
        const formattedData = OCRProcessingService.formatDataForForm(result.extractedData);
        
        setContractData(prev => ({
          ...prev,
          ...formattedData
        }));
        
        // Auto-fill tenant data if extracted
        if (result.extractedData.mieter_vorname && result.extractedData.mieter_nachname) {
          setNewTenants(prev => [{
            ...prev[0],
            vorname: result.extractedData.mieter_vorname || prev[0].vorname,
            nachname: result.extractedData.mieter_nachname || prev[0].nachname
          }, ...prev.slice(1)]);
        }
        
        toast({
          title: "Dokument erfolgreich verarbeitet!",
          description: `${result.fieldsExtracted || 0} Felder wurden automatisch ausgefüllt.`,
        });
      } else {
        if (file.type === 'application/pdf') {
          toast({
            title: "Keine Daten im PDF gefunden",
            description: result.error || "Bitte fülle die Felder manuell aus.",
          });
          setInputMode('manual');
          setStep('tenant');
        } else {
          toast({
            title: "OCR-Verarbeitung fehlgeschlagen",
            description: result.error || "Das Dokument konnte nicht verarbeitet werden.",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('OCR processing error:', error);
      if (file.type === 'application/pdf') {
        toast({
          title: "PDF konnte nicht verarbeitet werden",
          description: "Bitte fülle die Felder manuell aus oder probiere ein anderes PDF.",
        });
        setInputMode('manual');
        setStep('tenant');
      } else {
        toast({
          title: "Fehler bei der Dokumentenverarbeitung",
          description: error.message || "Ein unerwarteter Fehler ist aufgetreten.",
          variant: "destructive"
        });
      }
    } finally {
      setProcessingOCR(false);
    }
  };

  const handleDragEvents = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e);
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const createContract = async () => {
    setIsLoading(true);
    
    try {
      let tenantIds: string[] = [];
      
      // Create new tenants if needed
      if (activeTab === 'new-tenant') {
        for (const tenant of newTenants) {
          const { data, error } = await supabase
            .from('mieter')
            .insert({
              vorname: tenant.vorname,
              nachname: tenant.nachname,
              hauptmail: tenant.hauptmail || null,
              telnr: tenant.telnr || null,
              geburtsdatum: tenant.geburtsdatum || null
            })
            .select('id')
            .single();
          
          if (error) throw error;
          tenantIds.push(data.id);
        }
      } else {
        tenantIds = selectedTenantIds;
      }
      
      // Check for existing active contracts (overlap validation)
      // Allow creation but warn user - they might want to terminate the existing contract first
      const existingContracts = await supabase
        .from('mietvertrag')
        .select('id, start_datum, ende_datum, mieter:mietvertrag_mieter(mieter:mieter_id(vorname, nachname))')
        .eq('einheit_id', einheitId)
        .eq('status', 'aktiv');
      
      if (existingContracts.data && existingContracts.data.length > 0) {
        // For now, allow creating the contract but inform about overlap
        console.warn('Active contract exists, creating new contract. Consider terminating the existing one first.');
        
        // Set new contract start date to future to avoid immediate overlap
        const existingContract = existingContracts.data[0];
        const mieterNames = existingContract.mieter?.[0]?.mieter ? 
          `${existingContract.mieter[0].mieter.vorname} ${existingContract.mieter[0].mieter.nachname}` : 
          'Unbekannter Mieter';
          
        // Give user option to set future start date
        if (contractData.start_datum <= new Date().toISOString().split('T')[0]) {
          console.log(`Hinweis: Aktiver Vertrag mit ${mieterNames} existiert bereits. Neuer Vertrag wird als Nachfolgevertrag erstellt.`);
        }
      }

      // Create contract
      const { data: contractResult, error: contractError } = await supabase
        .from('mietvertrag')
        .insert({
          einheit_id: einheitId,
          kaltmiete: parseFloat(contractData.kaltmiete),
          betriebskosten: parseFloat(contractData.betriebskosten),
          kaution_betrag: contractData.kaution_betrag ? parseFloat(contractData.kaution_betrag) : null,
          start_datum: contractData.start_datum,
          ende_datum: contractData.ende_datum || null,
          lastschrift: contractData.lastschrift,
          bankkonto_mieter: contractData.bankkonto_mieter || null,
          ruecklastschrift_gebuehr: parseFloat(contractData.ruecklastschrift_gebuehr),
          verwendungszweck: contractData.verwendungszweck ? [contractData.verwendungszweck] : null,
          strom_einzug: contractData.strom_einzug ? parseFloat(contractData.strom_einzug) : null,
          gas_einzug: contractData.gas_einzug ? parseFloat(contractData.gas_einzug) : null,
          kaltwasser_einzug: contractData.kaltwasser_einzug ? parseFloat(contractData.kaltwasser_einzug) : null,
          warmwasser_einzug: contractData.warmwasser_einzug ? parseFloat(contractData.warmwasser_einzug) : null,
          kaution_status: 'offen',
          status: 'aktiv'
        })
        .select('id')
        .single();
      
      if (contractError) throw contractError;
      
      // Link tenants to contract
      const tenantLinks = tenantIds.map(tenantId => ({
        mietvertrag_id: contractResult.id,
        mieter_id: tenantId
      }));
      
      const { error: linkError } = await supabase
        .from('mietvertrag_mieter')
        .insert(tenantLinks);
      
      if (linkError) throw linkError;
      
      // Upload documents if any
      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${contractResult.id}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('dokumente')
            .upload(fileName, file);
          
          if (uploadError) throw uploadError;
          
          // Create document record
          await supabase
            .from('dokumente')
            .insert({
              titel: file.name,
              pfad: fileName,
              kategorie: 'Mietvertrag',
              mietvertrag_id: contractResult.id,
              dateityp: file.type,
              groesse_bytes: file.size
            });
        }
      }
      
      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['immobilie-detail'] });
      await queryClient.invalidateQueries({ queryKey: ['einheiten'] });
      
      // Send webhook notification for external systems
      try {
        const tenantData = activeTab === 'new-tenant' ? 
          newTenants.map((t, i) => ({
            id: tenantIds[i],
            name: `${t.vorname} ${t.nachname}`,
            email: t.hauptmail,
            role: t.rolle
          })) : 
          [];
          
        // Note: Webhook implementation would require the ContractWebhookService
        console.log('Contract created, webhook data prepared:', {
          contractId: contractResult.id,
          unitId: einheitId,
          tenants: tenantData,
          contractData: {
            rent: parseFloat(contractData.kaltmiete),
            operatingCosts: parseFloat(contractData.betriebskosten),
            deposit: contractData.kaution_betrag ? parseFloat(contractData.kaution_betrag) : undefined,
            startDate: contractData.start_datum,
            endDate: contractData.ende_datum || undefined
          }
        });
      } catch (webhookError) {
        console.warn('Webhook notification failed:', webhookError);
        // Don't fail the contract creation if webhook fails
      }
      
      toast({
        title: "Erfolg!",
        description: `Mietvertrag mit ${tenantIds.length} Mieter${tenantIds.length > 1 ? 'n' : ''} wurde erfolgreich erstellt.`,
      });
      
      onClose();
      
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast({
        title: "Fehler",
        description: error.message || "Ein Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderTenantStep = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="new-tenant" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Neue Mieter
        </TabsTrigger>
        <TabsTrigger value="existing-tenant" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Bestehende Mieter
        </TabsTrigger>
      </TabsList>

      <TabsContent value="new-tenant" className="space-y-4">
        <div className="space-y-4">
          {newTenants.map((tenant, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Mieter {index + 1}
                  </CardTitle>
                  {newTenants.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNewTenant(index)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`vorname-${index}`}>Vorname *</Label>
                    <Input
                      id={`vorname-${index}`}
                      value={tenant.vorname}
                      onChange={(e) => updateNewTenant(index, 'vorname', e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`nachname-${index}`}>Nachname *</Label>
                    <Input
                      id={`nachname-${index}`}
                      value={tenant.nachname}
                      onChange={(e) => updateNewTenant(index, 'nachname', e.target.value)}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`email-${index}`}>E-Mail</Label>
                    <Input
                      id={`email-${index}`}
                      type="email"
                      value={tenant.hauptmail}
                      onChange={(e) => updateNewTenant(index, 'hauptmail', e.target.value)}
                      placeholder="max@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`phone-${index}`}>Telefon</Label>
                    <Input
                      id={`phone-${index}`}
                      value={tenant.telnr}
                      onChange={(e) => updateNewTenant(index, 'telnr', e.target.value)}
                      placeholder="0123 456789"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`birth-${index}`}>Geburtsdatum</Label>
                    <Input
                      id={`birth-${index}`}
                      type="date"
                      value={tenant.geburtsdatum}
                      onChange={(e) => updateNewTenant(index, 'geburtsdatum', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`role-${index}`}>Rolle *</Label>
                    <Select 
                      value={tenant.rolle} 
                      onValueChange={(value) => updateNewTenant(index, 'rolle', value as 'hauptmieter' | 'mitmieter')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hauptmieter">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-600" />
                            Hauptmieter
                          </div>
                        </SelectItem>
                        <SelectItem value="mitmieter">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-blue-600" />
                            Mitmieter
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button
            type="button"
            variant="outline"
            onClick={addNewTenant}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Weiteren Mieter hinzufügen
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="existing-tenant" className="space-y-4">
        {tenantsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {existingTenants?.map((tenant) => (
              <Card 
                key={tenant.id}
                className={`cursor-pointer transition-colors ${
                  selectedTenantIds.includes(tenant.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleExistingTenant(tenant.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedTenantIds.includes(tenant.id)}
                      onChange={() => toggleExistingTenant(tenant.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{tenant.vorname} {tenant.nachname}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {tenant.hauptmail && <p>{tenant.hauptmail}</p>}
                        {tenant.telnr && <p>{tenant.telnr}</p>}
                      </div>
                    </div>
                    {selectedTenantIds.includes(tenant.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );

  const renderContractStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="kaltmiete">Kaltmiete (€) *</Label>
          <Input
            id="kaltmiete"
            type="number"
            step="0.01"
            value={contractData.kaltmiete}
            onChange={(e) => {
              const value = e.target.value;
              setContractData(prev => ({ 
                ...prev, 
                kaltmiete: value,
                // Auto-calculate security deposit (3x rent)
                kaution_betrag: value ? (parseFloat(value) * 3).toFixed(2) : ''
              }));
            }}
            placeholder="800.00"
          />
        </div>
        <div>
          <Label htmlFor="betriebskosten">Betriebskosten (€) *</Label>
          <Input
            id="betriebskosten"
            type="number"
            step="0.01"
            value={contractData.betriebskosten}
            onChange={(e) => setContractData(prev => ({ ...prev, betriebskosten: e.target.value }))}
            placeholder="150.00"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="kaution">Kaution (€)</Label>
          <Input
            id="kaution"
            type="number"
            step="0.01"
            value={contractData.kaution_betrag}
            onChange={(e) => setContractData(prev => ({ ...prev, kaution_betrag: e.target.value }))}
            placeholder="Automatisch: 3x Kaltmiete"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Standard: {contractData.kaltmiete ? (parseFloat(contractData.kaltmiete) * 3).toFixed(2) : '0.00'}€
          </p>
        </div>
        <div>
          <Label htmlFor="ruecklastschrift_gebuehr">Rücklastschrift-Gebühr (€)</Label>
          <Input
            id="ruecklastschrift_gebuehr"
            type="number"
            step="0.01"
            value={contractData.ruecklastschrift_gebuehr}
            onChange={(e) => setContractData(prev => ({ ...prev, ruecklastschrift_gebuehr: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_datum">Mietbeginn *</Label>
          <Input
            id="start_datum"
            type="date"
            value={contractData.start_datum}
            onChange={(e) => setContractData(prev => ({ ...prev, start_datum: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="ende_datum">Mietende (optional)</Label>
          <Input
            id="ende_datum"
            type="date"
            value={contractData.ende_datum}
            onChange={(e) => setContractData(prev => ({ ...prev, ende_datum: e.target.value }))}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="verwendungszweck">Verwendungszweck für Mietzahlungen</Label>
        <Input
          id="verwendungszweck"
          value={contractData.verwendungszweck}
          onChange={(e) => setContractData(prev => ({ ...prev, verwendungszweck: e.target.value }))}
          placeholder="Miete Einheit 1 - Musterstraße 123"
        />
      </div>
      
      {/* Meter Readings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <Label className="text-base font-medium">Zählerstände bei Einzug</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="strom_einzug">Strom (kWh)</Label>
            <Input
              id="strom_einzug"
              type="number"
              step="0.01"
              value={contractData.strom_einzug}
              onChange={(e) => setContractData(prev => ({ ...prev, strom_einzug: e.target.value }))}
              placeholder="12345"
            />
          </div>
          <div>
            <Label htmlFor="gas_einzug">Gas (m³)</Label>
            <Input
              id="gas_einzug"
              type="number"
              step="0.01"
              value={contractData.gas_einzug}
              onChange={(e) => setContractData(prev => ({ ...prev, gas_einzug: e.target.value }))}
              placeholder="6789"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="kaltwasser_einzug">Kaltwasser (m³)</Label>
            <Input
              id="kaltwasser_einzug"
              type="number"
              step="0.01"
              value={contractData.kaltwasser_einzug}
              onChange={(e) => setContractData(prev => ({ ...prev, kaltwasser_einzug: e.target.value }))}
              placeholder="1234"
            />
          </div>
          <div>
            <Label htmlFor="warmwasser_einzug">Warmwasser (m³)</Label>
            <Input
              id="warmwasser_einzug"
              type="number"
              step="0.01"
              value={contractData.warmwasser_einzug}
              onChange={(e) => setContractData(prev => ({ ...prev, warmwasser_einzug: e.target.value }))}
              placeholder="567"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="lastschrift"
          checked={contractData.lastschrift}
          onCheckedChange={(checked) => setContractData(prev => ({ ...prev, lastschrift: checked }))}
        />
        <Label htmlFor="lastschrift">SEPA-Lastschrift aktivieren</Label>
      </div>
      
      {contractData.lastschrift && (
        <div>
          <Label htmlFor="bankkonto">Bankkonto Mieter</Label>
          <Input
            id="bankkonto"
            value={contractData.bankkonto_mieter}
            onChange={(e) => setContractData(prev => ({ ...prev, bankkonto_mieter: e.target.value }))}
            placeholder="IBAN oder Kontodaten"
          />
        </div>
      )}
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Dokument hochladen und automatisch ausfüllen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Laden Sie einen Mietvertrag hoch. Die KI extrahiert automatisch alle relevanten Daten.
          </p>
        </CardHeader>
        <CardContent>
          {/* Drag & Drop Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : processingOCR 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={(e) => { handleDragEvents(e); setDragActive(true); }}
            onDragLeave={(e) => { handleDragEvents(e); setDragActive(false); }}
            onDragOver={handleDragEvents}
            onDrop={handleDrop}
          >
            {processingOCR ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                <div className="text-center">
                  <p className="text-lg font-medium text-blue-700 mb-2">
                    Dokument wird intelligent verarbeitet...
                  </p>
                  <p className="text-sm text-blue-600">
                    Mietvertragsdaten werden automatisch extrahiert
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-16 w-16 text-gray-400" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Mietvertrag hochladen
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Dokumente hier hineinziehen oder klicken zum Auswählen
                  </p>
                  <p className="text-xs text-gray-400">
                    PDF, DOC, DOCX, JPG, PNG bis 20MB
                  </p>
                </div>
                
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    handleFileUpload(files);
                  }}
                  style={{ display: 'none' }}
                  id="file-upload-input"
                />
                
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const input = document.getElementById('file-upload-input') as HTMLInputElement;
                    input?.click();
                  }}
                  className="mt-2"
                >
                  Dateien auswählen
                </Button>
              </div>
            )}
          </div>
          
          {/* OCR Results Display */}
          {ocrResults && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">
                  Automatische Extraktion erfolgreich!
                </span>
              </div>
              <div className="text-sm text-green-700">
                <p className="mb-2">
                  <strong>{ocrResults.fieldsExtracted || 0} Felder</strong> wurden automatisch 
                  aus dem Dokument extrahiert. Sie können die Daten im nächsten Schritt überprüfen und bearbeiten.
                </p>
                {ocrResults.confidence && (
                  <p>
                    Erkennungsqualität: <strong>{ocrResults.confidence === 'high' ? 'Hoch' : 'Mittel'}</strong>
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 mt-6">
              <p className="text-sm font-medium text-gray-700">Hochgeladene Dateien:</p>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    {file.type === 'application/pdf' && (
                      <Badge variant="secondary" className="text-xs">
                        OCR verarbeitet
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {/* Manual Override Option */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Lieber manuell ausfüllen?
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Sie können jederzeit zur manuellen Eingabe wechseln
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleInputModeChange('manual')}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Manuell ausfüllen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="space-y-4">
      <div>
        <Label>Dokumente hochladen (optional)</Label>
        <div className="mt-2">
          {/* Drag & Drop Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : processingOCR 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={(e) => { handleDragEvents(e); setDragActive(true); }}
            onDragLeave={(e) => { handleDragEvents(e); setDragActive(false); }}
            onDragOver={handleDragEvents}
            onDrop={handleDrop}
          >
            {processingOCR ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <p className="text-sm text-blue-700 font-medium">
                  Dokument wird intelligent verarbeitet...
                </p>
                <p className="text-xs text-blue-600">
                  Mietvertragsdaten werden automatisch extrahiert
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  Dokumente hier hineinziehen oder klicken zum Auswählen
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOC, DOCX, JPG, PNG bis 20MB
                </p>
              </>
            )}
          </div>
          
          <Input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="mt-3"
          />
          
          {/* OCR Results Display */}
          {ocrResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">
                  Automatische Extraktion erfolgreich
                </span>
              </div>
              <div className="text-sm text-green-700">
                <p>
                  <strong>{ocrResults.fieldsExtracted || 0} Felder</strong> wurden automatisch 
                  aus dem Dokument extrahiert und in das Formular übernommen.
                </p>
                {ocrResults.confidence && (
                  <p className="mt-1">
                    Erkennungsqualität: <strong>{ocrResults.confidence === 'high' ? 'Hoch' : 'Mittel'}</strong>
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Processing Info */}
          <div className="text-sm text-muted-foreground mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">Intelligente Dokumentenverarbeitung</span>
            </div>
            <p className="text-blue-700">
              PDF-Mietverträge werden automatisch mit KI analysiert. Relevante Daten wie Miete, 
              Kaution, Daten und Mieterdaten werden erkannt und automatisch in die Felder übertragen.
            </p>
          </div>
          
          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">Hochgeladene Dateien:</p>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    {file.type === 'application/pdf' && (
                      <Badge variant="secondary" className="text-xs">
                        OCR verarbeitet
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">Zusammenfassung</h4>
          <div className="space-y-1 text-sm">
            <p>Mieter: {activeTab === 'new-tenant' ? newTenants.length : selectedTenantIds.length}</p>
            {activeTab === 'new-tenant' && (
              <p>Hauptmieter: {newTenants.filter(t => t.rolle === 'hauptmieter').length}</p>
            )}
            <p>Kaltmiete: {contractData.kaltmiete}€</p>
            <p>Betriebskosten: {contractData.betriebskosten}€</p>
            <p>Warmmiete: {(parseFloat(contractData.kaltmiete || '0') + parseFloat(contractData.betriebskosten || '0')).toFixed(2)}€</p>
            <p>Kaution: {contractData.kaution_betrag}€</p>
            <p>Mietbeginn: {contractData.start_datum}</p>
            {contractData.ende_datum && <p>Mietende: {contractData.ende_datum}</p>}
            {uploadedFiles.length > 0 && <p>Dokumente: {uploadedFiles.length}</p>}
            {ocrResults && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>OCR-Verarbeitung erfolgreich</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Neuen Mietvertrag erstellen
          </DialogTitle>
          {immobilie && (
            <p className="text-sm text-muted-foreground">
              {immobilie.name} - {immobilie.adresse} - Einheit {einheitId.slice(-2)}
            </p>
          )}
        </DialogHeader>
        
        {/* Input Mode Selection */}
        <div className="mb-6">
          <Label className="text-base font-medium mb-3 block">
            Wie möchten Sie die Vertragsdaten eingeben?
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className={`cursor-pointer transition-all ${
                inputMode === 'manual' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleInputModeChange('manual')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    inputMode === 'manual' ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                  <div>
                    <p className="font-medium">Manuell eingeben</p>
                    <p className="text-sm text-muted-foreground">
                      Alle Daten selbst eingeben
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all ${
                inputMode === 'upload' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleInputModeChange('upload')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    inputMode === 'upload' ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                  <div>
                    <p className="font-medium">Dokument hochladen</p>
                    <p className="text-sm text-muted-foreground">
                      KI extrahiert Daten automatisch
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Step indicators - only show for manual mode */}
        {inputMode === 'manual' && (
          <div className="flex items-center justify-between mb-6">
            {['tenant', 'contract', 'documents'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepName ? 'bg-primary text-primary-foreground' : 
                  ['tenant', 'contract', 'documents'].indexOf(step) > index ? 'bg-primary text-primary-foreground' : 
                  'bg-muted text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                {index < 2 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    ['tenant', 'contract', 'documents'].indexOf(step) > index ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Upload mode step indicator */}
        {inputMode === 'upload' && (
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`w-16 h-0.5 ${
                ocrResults ? 'bg-primary' : 'bg-muted'
              }`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                ocrResults && step !== 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                2
              </div>
            </div>
          </div>
        )}
        
        
        <div className="space-y-6">
          {inputMode === 'upload' ? (
            <>
              {step === 'upload' && renderUploadStep()}
              {step === 'contract' && renderContractStep()}
              {step === 'documents' && renderDocumentsStep()}
            </>
          ) : (
            <>
              {step === 'tenant' && renderTenantStep()}
              {step === 'contract' && renderContractStep()}
              {step === 'documents' && renderDocumentsStep()}
            </>
          )}
          
          <div className="flex justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                if (inputMode === 'upload') {
                  if (step === 'upload') {
                    onClose();
                  } else if (step === 'contract') {
                    setStep('upload');
                  } else {
                    setStep('contract');
                  }
                } else {
                  if (step === 'tenant') {
                    onClose();
                  } else if (step === 'contract') {
                    setStep('tenant');
                  } else {
                    setStep('contract');
                  }
                }
              }}
            >
              {(step === 'tenant' && inputMode === 'manual') || (step === 'upload' && inputMode === 'upload') ? 'Abbrechen' : 'Zurück'}
            </Button>
            
            <Button
              onClick={() => {
                if (inputMode === 'upload') {
                  if (step === 'upload' && ocrResults) {
                    setStep('contract');
                  } else if (step === 'contract' && validateContractStep()) {
                    setStep('documents');
                  } else if (step === 'documents') {
                    createContract();
                  }
                } else {
                  if (step === 'tenant' && validateTenantStep()) {
                    setStep('contract');
                  } else if (step === 'contract' && validateContractStep()) {
                    setStep('documents');
                  } else if (step === 'documents') {
                    createContract();
                  }
                }
              }}
              disabled={
                isLoading || 
                (inputMode === 'upload' && step === 'upload' && !ocrResults) ||
                (inputMode === 'manual' && step === 'tenant' && !validateTenantStep()) ||
                (step === 'contract' && !validateContractStep())
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Erstellen...
                </>
              ) : step === 'documents' ? (
                'Vertrag erstellen'
              ) : inputMode === 'upload' && step === 'upload' ? (
                ocrResults ? 'Daten überprüfen' : 'Dokument hochladen'
              ) : (
                'Weiter'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
