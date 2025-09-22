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
import { Loader2, User, Users, Plus, Check, Calendar, Euro, FileUp, X, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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
  const [activeTab, setActiveTab] = useState("new-tenant");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'tenant' | 'contract' | 'documents'>('tenant');
  
  // New tenant form state
  const [newTenants, setNewTenants] = useState<NewTenant[]>([{
    vorname: '',
    nachname: '',
    hauptmail: '',
    telnr: '',
    geburtsdatum: ''
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
    ruecklastschrift_gebuehr: '7.50'
  });
  
  // Document upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
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
      setStep('tenant');
      setActiveTab('new-tenant');
      setNewTenants([{
        vorname: '',
        nachname: '',
        hauptmail: '',
        telnr: '',
        geburtsdatum: ''
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
        ruecklastschrift_gebuehr: '7.50'
      });
      setUploadedFiles([]);
    }
  }, [isOpen]);

  const addNewTenant = () => {
    setNewTenants([...newTenants, {
      vorname: '',
      nachname: '',
      hauptmail: '',
      telnr: '',
      geburtsdatum: ''
    }]);
  };

  const updateNewTenant = (index: number, field: keyof NewTenant, value: string) => {
    const updated = [...newTenants];
    updated[index][field] = value;
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
      return newTenants.every(tenant => 
        tenant.vorname.trim() && tenant.nachname.trim()
      );
    } else {
      return selectedTenantIds.length > 0;
    }
  };

  const validateContractStep = () => {
    return contractData.kaltmiete && contractData.betriebskosten && contractData.start_datum;
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
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
                
                <div>
                  <Label htmlFor={`birth-${index}`}>Geburtsdatum</Label>
                  <Input
                    id={`birth-${index}`}
                    type="date"
                    value={tenant.geburtsdatum}
                    onChange={(e) => updateNewTenant(index, 'geburtsdatum', e.target.value)}
                  />
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
            onChange={(e) => setContractData(prev => ({ ...prev, kaltmiete: e.target.value }))}
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
            placeholder="1500.00"
          />
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

  const renderDocumentsStep = () => (
    <div className="space-y-4">
      <div>
        <Label>Dokumente hochladen (optional)</Label>
        <div className="mt-2">
          <Input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="mb-4"
          />
          
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ausgewählte Dateien:</p>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                  <span className="text-sm">{file.name}</span>
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
            <p>Kaltmiete: {contractData.kaltmiete}€</p>
            <p>Betriebskosten: {contractData.betriebskosten}€</p>
            <p>Warmmiete: {(parseFloat(contractData.kaltmiete) + parseFloat(contractData.betriebskosten)).toFixed(2)}€</p>
            <p>Mietbeginn: {contractData.start_datum}</p>
            {uploadedFiles.length > 0 && <p>Dokumente: {uploadedFiles.length}</p>}
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
              {immobilie.name} - {immobilie.adresse}
            </p>
          )}
        </DialogHeader>
        
        {/* Step indicators */}
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
        
        <div className="space-y-6">
          {step === 'tenant' && renderTenantStep()}
          {step === 'contract' && renderContractStep()}
          {step === 'documents' && renderDocumentsStep()}
          
          <div className="flex justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                if (step === 'tenant') {
                  onClose();
                } else if (step === 'contract') {
                  setStep('tenant');
                } else {
                  setStep('contract');
                }
              }}
            >
              {step === 'tenant' ? 'Abbrechen' : 'Zurück'}
            </Button>
            
            <Button
              onClick={() => {
                if (step === 'tenant' && validateTenantStep()) {
                  setStep('contract');
                } else if (step === 'contract' && validateContractStep()) {
                  setStep('documents');
                } else if (step === 'documents') {
                  createContract();
                }
              }}
              disabled={
                isLoading || 
                (step === 'tenant' && !validateTenantStep()) ||
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
