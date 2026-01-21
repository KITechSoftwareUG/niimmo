import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Filter, Building2, CreditCard, Zap, Droplets, Flame, ShieldCheck, AlertTriangle } from "lucide-react";

interface NichtmieteRegel {
  id: string;
  regel_typ: string;
  wert: string;
  beschreibung: string | null;
  aktiv: boolean;
  erstellt_am: string;
  aktualisiert_am: string;
}

const REGEL_TYPEN = [
  { value: "empfaenger", label: "Empfängername", icon: Building2, description: "Zahlung wird anhand des Empfängernamens erkannt" },
  { value: "verwendungszweck", label: "Verwendungszweck", icon: CreditCard, description: "Zahlung wird anhand des Verwendungszwecks erkannt" },
  { value: "iban", label: "IBAN", icon: ShieldCheck, description: "Zahlung wird anhand der IBAN erkannt" },
];

const REGEL_KATEGORIEN = [
  { label: "Strom", icon: Zap, keywords: ["strom", "stadtwerk", "evi", "avacon"] },
  { label: "Wasser", icon: Droplets, keywords: ["wasser", "zweckverband"] },
  { label: "Gas", icon: Flame, keywords: ["gas", "energie"] },
  { label: "Darlehen", icon: CreditCard, keywords: ["darlehen", "kredit", "bank"] },
  { label: "Sonstige", icon: Building2, keywords: [] },
];

export const NichtmieteRegelnManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTyp, setFilterTyp] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegel, setEditingRegel] = useState<NichtmieteRegel | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formRegelTyp, setFormRegelTyp] = useState("empfaenger");
  const [formWert, setFormWert] = useState("");
  const [formBeschreibung, setFormBeschreibung] = useState("");
  const [formAktiv, setFormAktiv] = useState(true);

  const { data: regeln, isLoading } = useQuery({
    queryKey: ['nichtmiete-regeln'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nichtmiete_regeln')
        .select('*')
        .order('regel_typ', { ascending: true })
        .order('wert', { ascending: true });
      if (error) throw error;
      return data as NichtmieteRegel[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newRegel: Omit<NichtmieteRegel, 'id' | 'erstellt_am' | 'aktualisiert_am'>) => {
      const { data, error } = await supabase
        .from('nichtmiete_regeln')
        .insert(newRegel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-regeln'] });
      toast.success("Regel erfolgreich erstellt");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Erstellen: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NichtmieteRegel> & { id: string }) => {
      const { data, error } = await supabase
        .from('nichtmiete_regeln')
        .update({ ...updates, aktualisiert_am: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-regeln'] });
      toast.success("Regel erfolgreich aktualisiert");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('nichtmiete_regeln')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-regeln'] });
      toast.success("Regel erfolgreich gelöscht");
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    }
  });

  const toggleAktivMutation = useMutation({
    mutationFn: async ({ id, aktiv }: { id: string; aktiv: boolean }) => {
      const { error } = await supabase
        .from('nichtmiete_regeln')
        .update({ aktiv, aktualisiert_am: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-regeln'] });
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormRegelTyp("empfaenger");
    setFormWert("");
    setFormBeschreibung("");
    setFormAktiv(true);
    setEditingRegel(null);
  };

  const openEditDialog = (regel: NichtmieteRegel) => {
    setEditingRegel(regel);
    setFormRegelTyp(regel.regel_typ);
    setFormWert(regel.wert);
    setFormBeschreibung(regel.beschreibung || "");
    setFormAktiv(regel.aktiv);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formWert.trim()) {
      toast.error("Bitte einen Wert eingeben");
      return;
    }

    const regelData = {
      regel_typ: formRegelTyp,
      wert: formWert.trim(),
      beschreibung: formBeschreibung.trim() || null,
      aktiv: formAktiv
    };

    if (editingRegel) {
      updateMutation.mutate({ id: editingRegel.id, ...regelData });
    } else {
      createMutation.mutate(regelData);
    }
  };

  const getRegelIcon = (wert: string) => {
    const lowerWert = wert.toLowerCase();
    for (const kategorie of REGEL_KATEGORIEN) {
      if (kategorie.keywords.some(kw => lowerWert.includes(kw))) {
        return kategorie.icon;
      }
    }
    return Building2;
  };

  const filteredRegeln = regeln?.filter(regel => {
    const matchesSearch = 
      regel.wert.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (regel.beschreibung?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterTyp === "all" || regel.regel_typ === filterTyp;
    return matchesSearch && matchesFilter;
  });

  const groupedRegeln = filteredRegeln?.reduce((acc, regel) => {
    const typ = regel.regel_typ;
    if (!acc[typ]) acc[typ] = [];
    acc[typ].push(regel);
    return acc;
  }, {} as Record<string, NichtmieteRegel[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Nichtmiete-Regeln</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Regeln zur automatischen Erkennung von Nichtmiete-Zahlungen
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Neue Regel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Regeln durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTyp} onValueChange={setFilterTyp}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {REGEL_TYPEN.map(typ => (
              <SelectItem key={typ.value} value={typ.value}>{typ.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{regeln?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Gesamt</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{regeln?.filter(r => r.aktiv).length || 0}</div>
          <div className="text-sm text-muted-foreground">Aktiv</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{regeln?.filter(r => r.regel_typ === 'empfaenger').length || 0}</div>
          <div className="text-sm text-muted-foreground">Empfänger</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{regeln?.filter(r => r.regel_typ === 'verwendungszweck').length || 0}</div>
          <div className="text-sm text-muted-foreground">Verwendungszweck</div>
        </Card>
      </div>

      {/* Rules List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-6">
          {groupedRegeln && Object.entries(groupedRegeln).map(([typ, typRegeln]) => {
            const typInfo = REGEL_TYPEN.find(t => t.value === typ);
            const TypeIcon = typInfo?.icon || Building2;
            
            return (
              <div key={typ} className="space-y-3">
                <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-foreground">{typInfo?.label || typ}</h4>
                  <Badge variant="secondary" className="ml-auto">{typRegeln.length}</Badge>
                </div>
                
                <div className="grid gap-2">
                  {typRegeln.map(regel => {
                    const RegelIcon = getRegelIcon(regel.wert);
                    return (
                      <Card 
                        key={regel.id} 
                        className={`transition-opacity ${!regel.aktiv ? 'opacity-50' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-muted">
                              <RegelIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{regel.wert}</div>
                              {regel.beschreibung && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {regel.beschreibung}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Switch
                                checked={regel.aktiv}
                                onCheckedChange={(checked) => 
                                  toggleAktivMutation.mutate({ id: regel.id, aktiv: checked })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(regel)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(regel.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {(!filteredRegeln || filteredRegeln.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Keine Regeln gefunden</p>
              <Button variant="link" onClick={openCreateDialog}>
                Erste Regel erstellen
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRegel ? "Regel bearbeiten" : "Neue Regel erstellen"}
            </DialogTitle>
            <DialogDescription>
              Definieren Sie einen Begriff, der Zahlungen automatisch als Nichtmiete kategorisiert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regel_typ">Regeltyp</Label>
              <Select value={formRegelTyp} onValueChange={setFormRegelTyp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGEL_TYPEN.map(typ => (
                    <SelectItem key={typ.value} value={typ.value}>
                      <div className="flex items-center gap-2">
                        <typ.icon className="h-4 w-4" />
                        <span>{typ.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {REGEL_TYPEN.find(t => t.value === formRegelTyp)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wert">Suchbegriff / Wert</Label>
              <Input
                id="wert"
                value={formWert}
                onChange={(e) => setFormWert(e.target.value)}
                placeholder={formRegelTyp === 'iban' ? 'DE89370400440532013000' : 'z.B. Avacon, Stadtwerke...'}
              />
              <p className="text-xs text-muted-foreground">
                Dieser Begriff wird in {formRegelTyp === 'empfaenger' ? 'Empfängernamen' : formRegelTyp === 'iban' ? 'IBANs' : 'Verwendungszwecken'} gesucht (Groß-/Kleinschreibung wird ignoriert)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beschreibung">Beschreibung (optional)</Label>
              <Input
                id="beschreibung"
                value={formBeschreibung}
                onChange={(e) => setFormBeschreibung(e.target.value)}
                placeholder="z.B. Stromversorger Region Hannover"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="aktiv">Regel aktiv</Label>
              <Switch
                id="aktiv"
                checked={formAktiv}
                onCheckedChange={setFormAktiv}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingRegel ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Regel löschen?
            </DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Regel wird dauerhaft entfernt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Abbrechen
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
