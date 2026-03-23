import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap, Flame, Droplets, Mail, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface VersorgerInfo {
  typ: 'strom' | 'gas' | 'wasser';
  label: string;
  icon: typeof Zap;
  name: string;
  email: string;
}

interface VersorgerBenachrichtigungDialogProps {
  isOpen: boolean;
  onClose: () => void;
  immobilieId: string;
  mieterName: string;
  uebergabeDatum: Date;
  zaehlerstaende: {
    strom?: string;
    gas?: string;
    wasser?: string;
  };
  adresse: string;
  einheitBezeichnung?: string;
  isEinzug?: boolean;
}

export const VersorgerBenachrichtigungDialog = ({
  isOpen,
  onClose,
  immobilieId,
  mieterName,
  uebergabeDatum,
  zaehlerstaende,
  adresse,
  einheitBezeichnung,
  isEinzug = false,
}: VersorgerBenachrichtigungDialogProps) => {
  const { toast } = useToast();
  const [versorger, setVersorger] = useState<VersorgerInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailTexte, setEmailTexte] = useState<{ [typ: string]: string }>({});
  const [copiedTyp, setCopiedTyp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const datumFormatiert = format(uebergabeDatum, "dd.MM.yyyy", { locale: de });
  const aktion = isEinzug ? "Einzug" : "Auszug";

  // Versorger-Daten laden
  useEffect(() => {
    if (!isOpen || !immobilieId) return;

    const fetchVersorger = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('immobilien')
        .select('versorger_strom_name, versorger_strom_email, versorger_gas_name, versorger_gas_email, versorger_wasser_name, versorger_wasser_email')
        .eq('id', immobilieId)
        .single();

      if (!data) {
        setIsLoading(false);
        return;
      }

      const liste: VersorgerInfo[] = [];
      if (data.versorger_strom_name || data.versorger_strom_email) {
        liste.push({
          typ: 'strom', label: 'Strom', icon: Zap,
          name: data.versorger_strom_name || '',
          email: data.versorger_strom_email || '',
        });
      }
      if (data.versorger_gas_name || data.versorger_gas_email) {
        liste.push({
          typ: 'gas', label: 'Gas', icon: Flame,
          name: data.versorger_gas_name || '',
          email: data.versorger_gas_email || '',
        });
      }
      if (data.versorger_wasser_name || data.versorger_wasser_email) {
        liste.push({
          typ: 'wasser', label: 'Wasser', icon: Droplets,
          name: data.versorger_wasser_name || '',
          email: data.versorger_wasser_email || '',
        });
      }

      setVersorger(liste);

      // E-Mail-Entwuerfe generieren
      const texte: { [typ: string]: string } = {};
      for (const v of liste) {
        const zaehlerstand = zaehlerstaende[v.typ] || 'nicht erfasst';
        texte[v.typ] = `Sehr geehrte Damen und Herren,

hiermit teilen wir Ihnen mit, dass am ${datumFormatiert} ein ${aktion} in folgender Wohnung stattgefunden hat:

Adresse: ${adresse}${einheitBezeichnung ? `, ${einheitBezeichnung}` : ''}
Mieter: ${mieterName}
Datum: ${datumFormatiert}
Zählerstand ${v.label}: ${zaehlerstand}

Bitte nehmen Sie die ${isEinzug ? 'Anmeldung' : 'Abmeldung'} entsprechend vor.

Mit freundlichen Grüßen
Nilmmo Projektentwicklung & Bau GmbH
Denis Mikyas
Egestorffstraße 11, 31319 Sehnde
Tel. 05138 – 600 72 72`;
      }
      setEmailTexte(texte);
      setIsLoading(false);
    };

    fetchVersorger();
  }, [isOpen, immobilieId, mieterName, datumFormatiert, aktion, adresse, einheitBezeichnung, zaehlerstaende, isEinzug]);

  const toggleSelected = (typ: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(typ)) next.delete(typ);
      else next.add(typ);
      return next;
    });
  };

  const copyToClipboard = async (typ: string) => {
    const v = versorger.find(x => x.typ === typ);
    if (!v) return;

    const text = `An: ${v.email}\nBetreff: ${aktion}smeldung - ${adresse}, ${mieterName}\n\n${emailTexte[typ]}`;
    await navigator.clipboard.writeText(text);
    setCopiedTyp(typ);
    setTimeout(() => setCopiedTyp(null), 2000);
    toast({ title: "In Zwischenablage kopiert", description: `E-Mail-Entwurf für ${v.label} kopiert.` });
  };

  const openMailClient = (typ: string) => {
    const v = versorger.find(x => x.typ === typ);
    if (!v || !v.email) return;

    const subject = encodeURIComponent(`${aktion}smeldung - ${adresse}, ${mieterName}`);
    const body = encodeURIComponent(emailTexte[typ] || '');
    window.open(`mailto:${v.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Versorger benachrichtigen
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : versorger.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Keine Versorger-Daten für diese Immobilie hinterlegt. Bitte pflegen Sie die Versorger-Informationen in der Zählerverwaltung.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wählen Sie die Versorger aus, die über den {aktion} informiert werden sollen. Sie können den E-Mail-Text bearbeiten und anschließend kopieren oder per E-Mail-Client öffnen.
              </p>

              {versorger.map((v) => {
                const Icon = v.icon;
                const isSelected = selected.has(v.typ);

                return (
                  <div key={v.typ} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`versorger-${v.typ}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleSelected(v.typ)}
                        />
                        <Label htmlFor={`versorger-${v.typ}`} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{v.label}</span>
                          <span className="text-muted-foreground text-xs">({v.name})</span>
                        </Label>
                      </div>
                      {v.email && (
                        <span className="text-xs text-muted-foreground">{v.email}</span>
                      )}
                    </div>

                    {isSelected && (
                      <>
                        <div>
                          <Label className="text-xs">E-Mail an</Label>
                          <Input
                            value={v.email}
                            readOnly
                            className="mt-1 h-8 text-sm bg-muted"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Nachricht (editierbar)</Label>
                          <Textarea
                            value={emailTexte[v.typ] || ''}
                            onChange={(e) => setEmailTexte(prev => ({ ...prev, [v.typ]: e.target.value }))}
                            className="mt-1 text-sm min-h-[150px]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(v.typ)}
                            className="gap-1.5"
                          >
                            {copiedTyp === v.typ ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedTyp === v.typ ? 'Kopiert' : 'Kopieren'}
                          </Button>
                          {v.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openMailClient(v.typ)}
                              className="gap-1.5"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Im E-Mail-Client öffnen
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
