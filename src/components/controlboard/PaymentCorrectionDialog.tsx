import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Building2, MapPin, Calendar, CheckCircle, Clock, XCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isValid, parseISO } from "date-fns";

interface ContractOption {
  id: string;
  mieter: string;
  immobilie: string;
  adresse?: string;
  gesamtmiete: number;
  start_datum?: string;
  ende_datum?: string;
  status?: string;
}

interface ImmobilieOption {
  id: string;
  name: string;
  adresse: string;
}

interface PaymentInfo {
  buchungsdatum: string;
  betrag: number;
  empfaengername?: string;
  verwendungszweck?: string;
}

interface PaymentCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentInfo | null;
  mode?: 'mietvertrag' | 'immobilie';
  // Mietvertrag mode
  contracts: ContractOption[];
  currentContractId: string | null;
  onSelectContract: (contractId: string | null) => void;
  // Immobilie mode
  immobilien?: ImmobilieOption[];
  currentImmobilieId?: string | null;
  onSelectImmobilie?: (immobilieId: string | null) => void;
}

export function PaymentCorrectionDialog({
  open,
  onOpenChange,
  payment,
  mode = 'mietvertrag',
  contracts,
  currentContractId,
  onSelectContract,
  immobilien = [],
  currentImmobilieId = null,
  onSelectImmobilie,
}: PaymentCorrectionDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContracts = contracts.filter((contract) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      contract.mieter.toLowerCase().includes(search) ||
      contract.immobilie.toLowerCase().includes(search) ||
      (contract.adresse?.toLowerCase().includes(search) ?? false)
    );
  });

  const filteredImmobilien = immobilien.filter((imm) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      imm.name.toLowerCase().includes(search) ||
      imm.adresse.toLowerCase().includes(search)
    );
  });

  const handleSelect = (id: string | null) => {
    if (mode === 'immobilie' && onSelectImmobilie) {
      onSelectImmobilie(id);
    } else {
      onSelectContract(id);
    }
    onOpenChange(false);
    setSearchTerm("");
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
      aktiv: { label: "Aktiv", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-200" },
      gekuendigt: { label: "Gekündigt", icon: Clock, className: "bg-orange-100 text-orange-800 border-orange-200" },
      beendet: { label: "Beendet", icon: XCircle, className: "bg-gray-100 text-gray-600 border-gray-200" },
    };
    return configs[status] || configs.aktiv;
  };

  const currentId = mode === 'immobilie' ? currentImmobilieId : currentContractId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'immobilie' ? 'Immobilie zuordnen' : 'Mietvertrag zuordnen'}
          </DialogTitle>
          {payment && (
            <div className="text-sm text-muted-foreground space-y-1 mt-2 bg-muted/50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Betrag:</strong> <span className={payment.betrag >= 0 ? "text-green-600" : "text-destructive"}>{payment.betrag.toFixed(2)} €</span></p>
                <p><strong>Datum:</strong> {payment.buchungsdatum && isValid(parseISO(payment.buchungsdatum)) ? format(parseISO(payment.buchungsdatum), "dd.MM.yyyy") : "-"}</p>
              </div>
              {payment.empfaengername && <p><strong>Absender:</strong> {payment.empfaengername}</p>}
              {payment.verwendungszweck && (
                <p className="text-xs whitespace-pre-wrap break-words"><strong>Verwendungszweck:</strong> {payment.verwendungszweck}</p>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={mode === 'immobilie' ? "Immobilie oder Adresse suchen..." : "Mieter, Immobilie oder Adresse suchen..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Remove assignment option */}
          {currentId && (
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => handleSelect(null)}
            >
              <X className="h-4 w-4 mr-2" />
              Zuordnung entfernen
            </Button>
          )}

          {/* List */}
          <ScrollArea className="flex-1 border rounded-lg min-h-[300px]">
            {mode === 'immobilie' ? (
              /* Immobilien List */
              filteredImmobilien.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchTerm ? "Keine Immobilien gefunden" : "Keine Immobilien verfügbar"}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {filteredImmobilien.map((imm) => {
                    const isCurrentlySelected = imm.id === currentImmobilieId;
                    return (
                      <div
                        key={imm.id}
                        className={`p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group ${
                          isCurrentlySelected ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handleSelect(imm.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold truncate">{imm.name}</span>
                              {isCurrentlySelected && (
                                <Badge className="bg-primary text-primary-foreground text-xs shrink-0">Aktuell</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{imm.adresse}</span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isCurrentlySelected ? "default" : "outline"}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            {isCurrentlySelected ? "Gewählt" : "Auswählen"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Contracts List */
              filteredContracts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchTerm ? "Keine Mietverträge gefunden" : "Keine Mietverträge verfügbar"}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {filteredContracts.map((contract) => {
                    const isCurrentlySelected = contract.id === currentContractId;
                    const statusConfig = getStatusConfig(contract.status || "aktiv");
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={contract.id}
                        className={`p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group ${
                          isCurrentlySelected ? "border-primary bg-primary/5" : ""
                        } ${contract.status === "beendet" ? "opacity-75 border-dashed" : ""}`}
                        onClick={() => handleSelect(contract.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold truncate">{contract.mieter}</span>
                              <Badge variant="outline" className={`text-xs flex items-center gap-1 shrink-0 ${statusConfig.className}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                              {isCurrentlySelected && (
                                <Badge className="bg-primary text-primary-foreground text-xs shrink-0">Aktuell</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{contract.immobilie}</span>
                            </div>
                            {contract.adresse && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{contract.adresse}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              {contract.start_datum && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {isValid(parseISO(contract.start_datum)) ? format(parseISO(contract.start_datum), "dd.MM.yyyy") : "-"}
                                    {contract.ende_datum && isValid(parseISO(contract.ende_datum)) && ` - ${format(parseISO(contract.ende_datum), "dd.MM.yyyy")}`}
                                  </span>
                                </div>
                              )}
                              <div className="font-medium text-foreground">
                                {contract.gesamtmiete.toFixed(2)} € / Monat
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isCurrentlySelected ? "default" : "outline"}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            {isCurrentlySelected ? "Gewählt" : "Auswählen"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
