import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Ruler, Users, Activity, Equal, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Nebenkostenart {
  id: string;
  name: string;
  verteilerschluessel_art: string;
}

interface NebenkostenArtenManagerProps {
  immobilieId: string;
  nebenkostenarten: Nebenkostenart[];
}

const VERTEILERSCHLUESSEL_OPTIONS = [
  { value: 'qm', label: 'Nach Quadratmetern', icon: Ruler, description: 'Anteil basierend auf der Wohnfläche' },
  { value: 'personen', label: 'Nach Personenzahl', icon: Users, description: 'Anteil basierend auf Bewohneranzahl' },
  { value: 'verbrauch', label: 'Nach Verbrauch', icon: Activity, description: 'Anteil basierend auf individuellem Verbrauch' },
  { value: 'gleich', label: 'Gleichmäßig', icon: Equal, description: 'Gleicher Anteil für alle Einheiten' },
  { value: 'individuell', label: 'Individuell', icon: Percent, description: 'Manuell festgelegte Prozentsätze' },
];

const VORLAGEN = [
  'Heizung',
  'Wasser/Abwasser',
  'Müllabfuhr',
  'Hausmeister',
  'Gebäudeversicherung',
  'Grundsteuer',
  'Allgemeinstrom',
  'Gartenpflege',
  'Schornsteinfeger',
  'Aufzug',
  'Winterdienst',
  'Hausreinigung',
];

export function NebenkostenArtenManager({ immobilieId, nebenkostenarten }: NebenkostenArtenManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVerteilerschluessel, setNewVerteilerschluessel] = useState('qm');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingVerteilerschluessel, setEditingVerteilerschluessel] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const existingNames = nebenkostenarten.map(n => n.name.toLowerCase());
  const availableVorlagen = VORLAGEN.filter(v => !existingNames.includes(v.toLowerCase()));

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast({
        title: "Name erforderlich",
        description: "Bitte geben Sie einen Namen für die Nebenkostenart ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('nebenkostenarten')
        .insert({
          immobilie_id: immobilieId,
          name: newName.trim(),
          verteilerschluessel_art: newVerteilerschluessel,
        });

      if (error) throw error;

      toast({
        title: "Nebenkostenart erstellt",
        description: `"${newName}" wurde erfolgreich hinzugefügt.`,
      });

      setNewName('');
      setNewVerteilerschluessel('qm');
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['nebenkostenarten', immobilieId] });
    } catch (error: any) {
      console.error('Error adding Nebenkostenart:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Nebenkostenart konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const { error } = await supabase
        .from('nebenkostenarten')
        .update({
          name: editingName.trim(),
          verteilerschluessel_art: editingVerteilerschluessel,
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: "Nebenkostenart aktualisiert",
        description: "Die Änderungen wurden gespeichert.",
      });

      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['nebenkostenarten', immobilieId] });
    } catch (error: any) {
      console.error('Error updating Nebenkostenart:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('nebenkostenarten')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: "Nebenkostenart gelöscht",
        description: "Die Nebenkostenart wurde erfolgreich entfernt.",
      });

      setDeleteDialogOpen(false);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['nebenkostenarten', immobilieId] });
    } catch (error: any) {
      console.error('Error deleting Nebenkostenart:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Nebenkostenart konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const getVerteilerschluesselInfo = (art: string) => {
    return VERTEILERSCHLUESSEL_OPTIONS.find(v => v.value === art) || VERTEILERSCHLUESSEL_OPTIONS[0];
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Nebenkostenarten</span>
            {!isAdding && (
              <Button 
                size="sm" 
                onClick={() => setIsAdding(true)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Vorlagen-Schnellauswahl */}
          {isAdding && availableVorlagen.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Schnellauswahl (Vorlagen):</p>
              <div className="flex flex-wrap gap-1">
                {availableVorlagen.slice(0, 6).map((vorlage) => (
                  <Badge
                    key={vorlage}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setNewName(vorlage)}
                  >
                    {vorlage}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Neue Nebenkostenart hinzufügen */}
          {isAdding && (
            <div className="p-3 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 space-y-3">
              <Input
                placeholder="Name der Nebenkostenart"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Select value={newVerteilerschluessel} onValueChange={setNewVerteilerschluessel}>
                <SelectTrigger>
                  <SelectValue placeholder="Verteilerschlüssel wählen" />
                </SelectTrigger>
                <SelectContent>
                  {VERTEILERSCHLUESSEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="flex-1">
                  <Check className="h-4 w-4 mr-1" />
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewName(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Liste der Nebenkostenarten */}
          {nebenkostenarten.length === 0 && !isAdding ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Noch keine Nebenkostenarten definiert.</p>
              <p className="text-xs mt-1">Fügen Sie Kostenarten hinzu, um die Verteilung zu konfigurieren.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nebenkostenarten.map((art) => {
                const verteilerschluesselInfo = getVerteilerschluesselInfo(art.verteilerschluessel_art);
                const isEditing = editingId === art.id;

                return (
                  <div
                    key={art.id}
                    className="p-3 border rounded-lg bg-white hover:bg-accent/50 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <Select value={editingVerteilerschluessel} onValueChange={setEditingVerteilerschluessel}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VERTEILERSCHLUESSEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <option.icon className="h-4 w-4" />
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdate} className="flex-1">
                            <Check className="h-4 w-4 mr-1" />
                            Speichern
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{art.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <verteilerschluesselInfo.icon className="h-3 w-3" />
                            <span>{verteilerschluesselInfo.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingId(art.id);
                              setEditingName(art.name);
                              setEditingVerteilerschluessel(art.verteilerschluessel_art);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteId(art.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nebenkostenart löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Nebenkostenart wirklich löschen? Alle zugehörigen Zuordnungen werden ebenfalls entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
