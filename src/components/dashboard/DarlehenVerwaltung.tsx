import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, Plus, Pencil, Trash2, Building2, CreditCard,
  X, Euro, Percent, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DarlehenVerwaltungProps {
  onBack: () => void;
}

interface Darlehen {
  id: string;
  bezeichnung: string;
  bank: string | null;
  kontonummer: string | null; // stores IBAN
  darlehensbetrag: number;
  restschuld: number | null;
  zinssatz_prozent: number | null;
  tilgungssatz_prozent: number | null;
  monatliche_rate: number | null;
  start_datum: string | null;
  ende_datum: string | null;
  notizen: string | null;
  erstellt_am: string | null;
}

interface Immobilie {
  id: string;
  name: string;
}

interface Zahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  empfaengername: string | null;
  iban: string | null;
  verwendungszweck: string | null;
  kategorie: string | null;
}

interface DarlehenImmobilie {
  id: string;
  darlehen_id: string;
  immobilie_id: string;
}

interface TilgungsplanEintrag {
  monat: string;
  datum: Date;
  rate: number;
  zinsanteil: number;
  tilgungsanteil: number;
  restschuld_davor: number;
  restschuld_danach: number;
}

interface DarlehenForm {
  bezeichnung: string;
  bank: string;
  kontonummer: string;
  darlehensbetrag: string;
  restschuld: string;
  zinssatz_prozent: string;
  tilgungssatz_prozent: string;
  monatliche_rate: string;
  start_datum: string;
  ende_datum: string;
  notizen: string;
  immobilien_ids: string[];
}

const FORM_EMPTY: DarlehenForm = {
  bezeichnung: "",
  bank: "",
  kontonummer: "",
  darlehensbetrag: "",
  restschuld: "",
  zinssatz_prozent: "",
  tilgungssatz_prozent: "",
  monatliche_rate: "",
  start_datum: "",
  ende_datum: "",
  notizen: "",
  immobilien_ids: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatProzent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return value.toFixed(2).replace(".", ",") + " %";
}

function formatIBAN(raw: string | null | undefined): string {
  if (!raw) return "–";
  const clean = raw.replace(/\s/g, "");
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function parseNum(s: string): number {
  const v = parseFloat(s.replace(",", "."));
  return isNaN(v) ? 0 : v;
}

function berechneTilgungsplan(
  restschuld: number,
  zinssatz: number,
  rate: number,
  endDatum: string | null,
): TilgungsplanEintrag[] {
  if (!rate || !zinssatz || !restschuld) return [];

  const plan: TilgungsplanEintrag[] = [];
  let rs = restschuld;
  const zinsMtl = zinssatz / 100 / 12;

  // Start next month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Max months: until Ende or 360 (30 Jahre)
  let maxMonate = 360;
  if (endDatum) {
    const end = new Date(endDatum);
    const diffMs = end.getTime() - start.getTime();
    maxMonate = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
  }

  for (let i = 0; i < maxMonate && rs > 0.01; i++) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const zinsanteil = rs * zinsMtl;
    const tilgungsanteil = Math.min(rate - zinsanteil, rs);
    if (tilgungsanteil <= 0) break; // Rate doesn't cover interest — avoid infinite loop
    const rs_nach = Math.max(0, rs - tilgungsanteil);

    plan.push({
      monat: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      datum: date,
      rate: zinsanteil + tilgungsanteil,
      zinsanteil,
      tilgungsanteil,
      restschuld_davor: rs,
      restschuld_danach: rs_nach,
    });

    rs = rs_nach;
  }

  return plan;
}

function berechneAutoRate(darlehensbetrag: number, zinssatz: number, tilgungssatz: number): number {
  return (darlehensbetrag * (zinssatz + tilgungssatz)) / 100 / 12;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DarlehenVerwaltung({ onBack }: DarlehenVerwaltungProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("tilgungsplan");
  const [showAllMonate, setShowAllMonate] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DarlehenForm>(FORM_EMPTY);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: darlehen = [], isLoading } = useQuery<Darlehen[]>({
    queryKey: ["darlehen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("darlehen")
        .select("*")
        .order("bezeichnung");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: darlehenImmobilien = [] } = useQuery<DarlehenImmobilie[]>({
    queryKey: ["darlehen_immobilien"],
    queryFn: async () => {
      const { data, error } = await supabase.from("darlehen_immobilien").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: immobilien = [] } = useQuery<Immobilie[]>({
    queryKey: ["immobilien_mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("immobilien")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedDarlehen = darlehen.find((d) => d.id === selectedId) ?? null;

  const { data: zahlungen = [] } = useQuery<Zahlung[]>({
    queryKey: ["darlehen_zahlungen_iban", selectedDarlehen?.kontonummer],
    queryFn: async () => {
      if (!selectedDarlehen?.kontonummer) return [];
      const clean = selectedDarlehen.kontonummer.replace(/\s/g, "");
      const { data, error } = await supabase
        .from("zahlungen")
        .select("id, betrag, buchungsdatum, empfaengername, iban, verwendungszweck, kategorie")
        .ilike("iban", `%${clean}%`)
        .order("buchungsdatum", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedDarlehen?.kontonummer,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: DarlehenForm }) => {
      const payload = {
        bezeichnung: data.bezeichnung.trim(),
        bank: data.bank.trim() || null,
        kontonummer: data.kontonummer.trim().replace(/\s/g, "") || null,
        darlehensbetrag: parseNum(data.darlehensbetrag),
        restschuld: parseNum(data.restschuld),
        zinssatz_prozent: parseNum(data.zinssatz_prozent),
        tilgungssatz_prozent: parseNum(data.tilgungssatz_prozent),
        monatliche_rate: parseNum(data.monatliche_rate),
        start_datum: data.start_datum || null,
        ende_datum: data.ende_datum || null,
        notizen: data.notizen.trim() || null,
      };

      let darlehenId = id;

      if (id) {
        const { error } = await supabase.from("darlehen").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("darlehen")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        darlehenId = created.id;
      }

      // Sync immobilien links
      await supabase.from("darlehen_immobilien").delete().eq("darlehen_id", darlehenId!);
      if (data.immobilien_ids.length > 0) {
        await supabase.from("darlehen_immobilien").insert(
          data.immobilien_ids.map((immoId) => ({
            darlehen_id: darlehenId!,
            immobilie_id: immoId,
          })),
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["darlehen"] });
      queryClient.invalidateQueries({ queryKey: ["darlehen_immobilien"] });
      closeDialog();
      toast.success(editId ? "Konto aktualisiert" : "Konto erstellt");
    },
    onError: (err: Error) => toast.error("Fehler: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("darlehen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["darlehen"] });
      queryClient.invalidateQueries({ queryKey: ["darlehen_immobilien"] });
      if (selectedId === id) setSelectedId(null);
      setDeleteConfirmId(null);
      toast.success("Konto gelöscht");
    },
    onError: (err: Error) => toast.error("Fehler: " + err.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditId(null);
    setForm(FORM_EMPTY);
    setShowDialog(true);
  }

  function openEdit(d: Darlehen) {
    const immoIds = darlehenImmobilien
      .filter((di) => di.darlehen_id === d.id)
      .map((di) => di.immobilie_id);

    setEditId(d.id);
    setForm({
      bezeichnung: d.bezeichnung,
      bank: d.bank ?? "",
      kontonummer: d.kontonummer ? formatIBAN(d.kontonummer) : "",
      darlehensbetrag: d.darlehensbetrag ? String(d.darlehensbetrag) : "",
      restschuld: d.restschuld ? String(d.restschuld) : "",
      zinssatz_prozent: d.zinssatz_prozent ? String(d.zinssatz_prozent) : "",
      tilgungssatz_prozent: d.tilgungssatz_prozent ? String(d.tilgungssatz_prozent) : "",
      monatliche_rate: d.monatliche_rate ? String(d.monatliche_rate) : "",
      start_datum: d.start_datum ?? "",
      ende_datum: d.ende_datum ?? "",
      notizen: d.notizen ?? "",
      immobilien_ids: immoIds,
    });
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditId(null);
    setForm(FORM_EMPTY);
  }

  function handleSave() {
    if (!form.bezeichnung.trim()) {
      toast.error("Bitte Bezeichnung angeben");
      return;
    }
    saveMutation.mutate({ id: editId, data: form });
  }

  function handleAutoRate() {
    const db = parseNum(form.darlehensbetrag);
    const zins = parseNum(form.zinssatz_prozent);
    const tilg = parseNum(form.tilgungssatz_prozent);
    if (!db || !zins || !tilg) {
      toast.error("Darlehensbetrag, Zinssatz und Tilgungssatz erforderlich");
      return;
    }
    const rate = berechneAutoRate(db, zins, tilg);
    setForm((f) => ({ ...f, monatliche_rate: rate.toFixed(2) }));
  }

  function toggleImmo(id: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      immobilien_ids: checked
        ? [...f.immobilien_ids, id]
        : f.immobilien_ids.filter((x) => x !== id),
    }));
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  function getLinkedImmobilien(darlehenId: string): Immobilie[] {
    const ids = darlehenImmobilien
      .filter((di) => di.darlehen_id === darlehenId)
      .map((di) => di.immobilie_id);
    return immobilien.filter((i) => ids.includes(i.id));
  }

  const gesamtschuld = darlehen.reduce((sum, d) => sum + (d.restschuld ?? 0), 0);
  const gesamtrate = darlehen.reduce((sum, d) => sum + (d.monatliche_rate ?? 0), 0);

  const tilgungsplan = useMemo(() => {
    if (!selectedDarlehen) return [];
    return berechneTilgungsplan(
      selectedDarlehen.restschuld ?? 0,
      selectedDarlehen.zinssatz_prozent ?? 0,
      selectedDarlehen.monatliche_rate ?? 0,
      selectedDarlehen.ende_datum,
    );
  }, [selectedDarlehen]);

  const angezeigterPlan = showAllMonate ? tilgungsplan : tilgungsplan.slice(0, 24);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Darlehenskonten</h1>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-500 h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Neues Konto
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Gesamtschuld</div>
          <div className="text-lg font-mono font-semibold text-red-400">
            {formatEuro(gesamtschuld)}
          </div>
          <div className="text-xs text-zinc-600 mt-0.5">{darlehen.length} Konten</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Rate gesamt / Monat</div>
          <div className="text-lg font-mono font-semibold text-orange-400">
            {formatEuro(gesamtrate)}
          </div>
          <div className="text-xs text-zinc-600 mt-0.5">Annuität</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Zinsanteil / Monat</div>
          <div className="text-lg font-mono font-semibold text-yellow-400">
            {formatEuro(
              darlehen.reduce((sum, d) => {
                if (!d.restschuld || !d.zinssatz_prozent) return sum;
                return sum + d.restschuld * (d.zinssatz_prozent / 100 / 12);
              }, 0),
            )}
          </div>
          <div className="text-xs text-zinc-600 mt-0.5">aktueller Zins</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Account list */}
        <div
          className={`flex flex-col overflow-y-auto border-r border-zinc-800 transition-all ${
            selectedId ? "w-80 min-w-80 shrink-0" : "flex-1"
          }`}
        >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Lädt…
            </div>
          ) : darlehen.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <CreditCard className="h-10 w-10 opacity-30" />
              <div className="text-sm">Noch keine Darlehenskonten</div>
              <Button
                variant="outline"
                size="sm"
                onClick={openCreate}
                className="border-zinc-700 text-zinc-300"
              >
                Erstes Konto anlegen
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {darlehen.map((d) => {
                const linked = getLinkedImmobilien(d.id);
                const isSelected = selectedId === d.id;
                const zinsProMonat =
                  d.restschuld && d.zinssatz_prozent
                    ? d.restschuld * (d.zinssatz_prozent / 100 / 12)
                    : null;
                const tilgungProMonat =
                  d.monatliche_rate && zinsProMonat
                    ? d.monatliche_rate - zinsProMonat
                    : null;

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedId(isSelected ? null : d.id);
                      setShowAllMonate(false);
                    }}
                    className={`p-4 cursor-pointer transition-colors border-l-2 ${
                      isSelected
                        ? "bg-blue-950/30 border-blue-500"
                        : "hover:bg-zinc-800/40 border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Name */}
                        <div className="font-medium text-sm text-white truncate mb-0.5">
                          {d.bezeichnung}
                        </div>

                        {/* Immobilien */}
                        {linked.length > 0 && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <Building2 className="h-3 w-3 text-zinc-600 shrink-0" />
                            <span className="text-xs text-zinc-400 truncate">
                              {linked.map((i) => i.name).join(", ")}
                            </span>
                          </div>
                        )}

                        {/* IBAN */}
                        {d.kontonummer && (
                          <div className="font-mono text-xs text-zinc-600 mb-2">
                            {formatIBAN(d.kontonummer)}
                          </div>
                        )}

                        {/* Restschuld + Rate */}
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="font-mono text-sm font-semibold text-red-400">
                            {formatEuro(d.restschuld)}
                          </span>
                          {d.monatliche_rate && (
                            <>
                              <span className="text-zinc-700 text-xs">·</span>
                              <span className="font-mono text-xs text-zinc-400">
                                {formatEuro(d.monatliche_rate)}/Monat
                              </span>
                            </>
                          )}
                        </div>

                        {/* Zinssatz / Tilgungssatz badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {d.zinssatz_prozent !== null && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-4 border-zinc-700 text-zinc-500 font-mono"
                            >
                              {formatProzent(d.zinssatz_prozent)} Zins
                            </Badge>
                          )}
                          {d.tilgungssatz_prozent !== null && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-4 border-zinc-700 text-zinc-500 font-mono"
                            >
                              {formatProzent(d.tilgungssatz_prozent)} Tilgung
                            </Badge>
                          )}
                          {zinsProMonat !== null && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-4 border-yellow-900 text-yellow-600 font-mono"
                            >
                              {formatEuro(zinsProMonat)} Zinsen
                            </Badge>
                          )}
                          {tilgungProMonat !== null && tilgungProMonat > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-4 border-green-900 text-green-600 font-mono"
                            >
                              {formatEuro(tilgungProMonat)} Tilgung
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-white"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-red-400"
                          onClick={() => setDeleteConfirmId(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedDarlehen && (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Detail header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <div>
                <div className="font-semibold text-sm text-white">
                  {selectedDarlehen.bezeichnung}
                </div>
                {selectedDarlehen.bank && (
                  <div className="text-xs text-zinc-500">{selectedDarlehen.bank}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:text-white"
                onClick={() => setSelectedId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs
              value={detailTab}
              onValueChange={setDetailTab}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <TabsList className="mx-4 mt-3 bg-zinc-900 border border-zinc-800 w-fit shrink-0">
                <TabsTrigger value="tilgungsplan" className="text-xs">
                  Tilgungsplan
                </TabsTrigger>
                <TabsTrigger value="zahlungen" className="text-xs">
                  Zahlungen
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs">
                  Details
                </TabsTrigger>
              </TabsList>

              {/* ── Tilgungsplan ── */}
              <TabsContent
                value="tilgungsplan"
                className="flex-1 overflow-auto px-4 pb-4 mt-3 data-[state=inactive]:hidden"
              >
                {!selectedDarlehen.restschuld ||
                !selectedDarlehen.zinssatz_prozent ||
                !selectedDarlehen.monatliche_rate ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                    <AlertCircle className="h-8 w-8 opacity-40" />
                    <div className="text-sm text-center">
                      Zinssatz, Rate und Restschuld hinterlegen,
                      <br />
                      um den Tilgungsplan zu berechnen.
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-zinc-300 mt-1"
                      onClick={() => openEdit(selectedDarlehen)}
                    >
                      Jetzt bearbeiten
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-zinc-500">
                        Ab {format(new Date(), "MMMM yyyy", { locale: de })} ·{" "}
                        {tilgungsplan.length} Raten bis Laufzeitende
                        {selectedDarlehen.ende_datum &&
                          ` (${selectedDarlehen.ende_datum})`}
                      </div>
                      {tilgungsplan.length > 24 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-zinc-400 hover:text-white px-2"
                          onClick={() => setShowAllMonate((v) => !v)}
                        >
                          {showAllMonate ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Weniger
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Alle {tilgungsplan.length} anzeigen
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                          <TableHead className="text-zinc-500 text-xs py-2">Monat</TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2 text-right">
                            Rate
                          </TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2 text-right">
                            Zinsen
                          </TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2 text-right">
                            Tilgung
                          </TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2 text-right">
                            Restschuld
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {angezeigterPlan.map((e) => (
                          <TableRow
                            key={e.monat}
                            className="border-zinc-800/50 hover:bg-zinc-800/30"
                          >
                            <TableCell className="text-xs text-zinc-300 py-1.5">
                              {format(e.datum, "MMM yyyy", { locale: de })}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-white py-1.5 text-right">
                              {formatEuro(e.rate)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-yellow-500 py-1.5 text-right">
                              {formatEuro(e.zinsanteil)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-green-500 py-1.5 text-right">
                              {formatEuro(e.tilgungsanteil)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-red-400 py-1.5 text-right">
                              {formatEuro(e.restschuld_danach)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {!showAllMonate && tilgungsplan.length > 24 && (
                      <div className="text-center text-xs text-zinc-600 py-3">
                        + {tilgungsplan.length - 24} weitere Monate
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── Zahlungen ── */}
              <TabsContent
                value="zahlungen"
                className="flex-1 overflow-auto px-4 pb-4 mt-3 data-[state=inactive]:hidden"
              >
                {!selectedDarlehen.kontonummer ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                    <AlertCircle className="h-8 w-8 opacity-40" />
                    <div className="text-sm">Keine IBAN hinterlegt.</div>
                  </div>
                ) : zahlungen.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                    <CreditCard className="h-8 w-8 opacity-40" />
                    <div className="text-sm text-center">
                      Keine Zahlungen mit IBAN
                      <br />
                      <span className="font-mono text-xs">
                        {formatIBAN(selectedDarlehen.kontonummer)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-zinc-500 mb-3">
                      {zahlungen.length} Zahlungen gefunden ·{" "}
                      <span className="font-mono">{formatIBAN(selectedDarlehen.kontonummer)}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                          <TableHead className="text-zinc-500 text-xs py-2">Datum</TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2">Empfänger</TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2">
                            Verwendungszweck
                          </TableHead>
                          <TableHead className="text-zinc-500 text-xs py-2 text-right">
                            Betrag
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zahlungen.map((z) => (
                          <TableRow
                            key={z.id}
                            className="border-zinc-800/50 hover:bg-zinc-800/30"
                          >
                            <TableCell className="text-xs text-zinc-300 py-1.5 whitespace-nowrap">
                              {z.buchungsdatum}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300 py-1.5 max-w-32 truncate">
                              {z.empfaengername || "–"}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-500 py-1.5 max-w-48 truncate">
                              {z.verwendungszweck || "–"}
                            </TableCell>
                            <TableCell
                              className={`text-xs font-mono py-1.5 text-right ${
                                z.betrag < 0 ? "text-red-400" : "text-green-400"
                              }`}
                            >
                              {formatEuro(z.betrag)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </TabsContent>

              {/* ── Details ── */}
              <TabsContent
                value="details"
                className="flex-1 overflow-auto px-4 pb-4 mt-3 data-[state=inactive]:hidden"
              >
                <div className="max-w-sm space-y-0 divide-y divide-zinc-800/60">
                  {(
                    [
                      ["Darlehensbetrag", formatEuro(selectedDarlehen.darlehensbetrag)],
                      ["Aktuelle Restschuld", formatEuro(selectedDarlehen.restschuld)],
                      ["Monatliche Rate", formatEuro(selectedDarlehen.monatliche_rate)],
                      ["Zinssatz p.a.", formatProzent(selectedDarlehen.zinssatz_prozent)],
                      ["Tilgungssatz p.a.", formatProzent(selectedDarlehen.tilgungssatz_prozent)],
                      [
                        "Zinsanteil / Monat",
                        selectedDarlehen.restschuld && selectedDarlehen.zinssatz_prozent
                          ? formatEuro(
                              selectedDarlehen.restschuld *
                                (selectedDarlehen.zinssatz_prozent / 100 / 12),
                            )
                          : "–",
                      ],
                      ["IBAN", formatIBAN(selectedDarlehen.kontonummer)],
                      ["Bank", selectedDarlehen.bank || "–"],
                      ["Laufzeit ab", selectedDarlehen.start_datum || "–"],
                      ["Laufzeit bis", selectedDarlehen.ende_datum || "–"],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-2.5">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <span className="text-xs font-mono text-white">{value}</span>
                    </div>
                  ))}
                  {selectedDarlehen.notizen && (
                    <div className="py-2.5">
                      <div className="text-xs text-zinc-500 mb-1">Notizen</div>
                      <div className="text-xs text-zinc-300 leading-relaxed">
                        {selectedDarlehen.notizen}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-zinc-700 text-zinc-300"
                  onClick={() => openEdit(selectedDarlehen)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Bearbeiten
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editId ? "Darlehenskonto bearbeiten" : "Neues Darlehenskonto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Bezeichnung */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Bezeichnung *</Label>
              <Input
                value={form.bezeichnung}
                onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))}
                placeholder="z. B. Obj. 01 AV MFH Saarstr."
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>

            {/* Bank + IBAN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Bank</Label>
                <Input
                  value={form.bank}
                  onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                  placeholder="z. B. Sparkasse"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">IBAN</Label>
                <Input
                  value={form.kontonummer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kontonummer: e.target.value.toUpperCase() }))
                  }
                  placeholder="DE81 2559 …"
                  className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm"
                />
              </div>
            </div>

            {/* Immobilien */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Zugehörige Immobilie(n)</Label>
              <div className="max-h-28 overflow-y-auto space-y-1 rounded border border-zinc-800 bg-zinc-900 p-2">
                {immobilien.map((immo) => (
                  <label
                    key={immo.id}
                    className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={form.immobilien_ids.includes(immo.id)}
                      onChange={(e) => toggleImmo(immo.id, e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span className="text-xs text-zinc-300">{immo.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Konditionen */}
            <div className="border-t border-zinc-800 pt-3">
              <div className="text-xs text-zinc-500 font-medium mb-3 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" />
                Konditionen
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Darlehensbetrag (€)</Label>
                  <Input
                    type="number"
                    value={form.darlehensbetrag}
                    onChange={(e) => setForm((f) => ({ ...f, darlehensbetrag: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Aktuelle Restschuld (€)</Label>
                  <Input
                    type="number"
                    value={form.restschuld}
                    onChange={(e) => setForm((f) => ({ ...f, restschuld: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Zinssatz (% p.a.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.zinssatz_prozent}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, zinssatz_prozent: e.target.value }))
                    }
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Tilgungssatz (% p.a.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.tilgungssatz_prozent}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tilgungssatz_prozent: e.target.value }))
                    }
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
              </div>

              {/* Rate */}
              <div className="space-y-1.5 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400">Monatliche Rate (€)</Label>
                  <button
                    type="button"
                    onClick={handleAutoRate}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Auto-berechnen
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monatliche_rate}
                  onChange={(e) => setForm((f) => ({ ...f, monatliche_rate: e.target.value }))}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
                {parseNum(form.darlehensbetrag) > 0 &&
                  parseNum(form.zinssatz_prozent) > 0 &&
                  parseNum(form.tilgungssatz_prozent) > 0 && (
                    <div className="text-xs text-zinc-600">
                      Berechnet:{" "}
                      {formatEuro(
                        berechneAutoRate(
                          parseNum(form.darlehensbetrag),
                          parseNum(form.zinssatz_prozent),
                          parseNum(form.tilgungssatz_prozent),
                        ),
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* Laufzeit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Laufzeit ab</Label>
                <Input
                  type="date"
                  value={form.start_datum}
                  onChange={(e) => setForm((f) => ({ ...f, start_datum: e.target.value }))}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Laufzeit bis</Label>
                <Input
                  type="date"
                  value={form.ende_datum}
                  onChange={(e) => setForm((f) => ({ ...f, ende_datum: e.target.value }))}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            </div>

            {/* Notizen */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Notizen</Label>
              <Textarea
                value={form.notizen}
                onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white resize-none"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeDialog}
              className="border-zinc-700 text-zinc-300"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {saveMutation.isPending ? "Speichern…" : editId ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Konto löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Das Darlehenskonto und alle zugehörigen Zuordnungen werden unwiderruflich gelöscht.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="border-zinc-700 text-zinc-300"
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Löschen…" : "Löschen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DarlehenVerwaltung;
