import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bekannte Utility-Schlüsselwörter für Versorgungskosten
const UTILITY_KEYWORDS = ["avacon", "darlehen", "leine", "stadtwerke", "evi", "wasserzweckverband"];

// BG-Zahlung IBAN (Jobcenter/Sozialamt)
const BG_ZAHLUNG_IBAN = "DE94760000000076001601";

interface Payment {
  buchungsdatum: string;
  betrag: number;
  iban: string;
  verwendungszweck: string;
  empfaengername?: string;
}

interface ProcessedPayment extends Payment {
  mietvertrag_id: string | null;
  kategorie: string;
  zuordnungsgrund: string;
  confidence: number;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nicht konfiguriert");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "assign_payment",
            description: "Ordne eine Zahlung einem Mietvertrag zu und kategorisiere sie",
            parameters: {
              type: "object",
              properties: {
                mietvertrag_id: { 
                  type: "string", 
                  description: "UUID des zugeordneten Mietvertrags oder null wenn nicht zuordenbar" 
                },
                kategorie: { 
                  type: "string", 
                  enum: ["Miete", "Mietkaution", "Rücklastschrift", "Nichtmiete", "Ignorieren"],
                  description: "Kategorie der Zahlung"
                },
                zuordnungsgrund: {
                  type: "string",
                  description: "Kurze Begründung für die Zuordnung"
                },
                confidence: {
                  type: "number",
                  description: "Konfidenz der Zuordnung (0-100)"
                }
              },
              required: ["kategorie", "zuordnungsgrund", "confidence"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "assign_payment" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway Error:", response.status, errorText);
    throw new Error(`AI Gateway Error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  
  throw new Error("Keine gültige AI-Antwort erhalten");
}

async function getContractContext(supabase: any): Promise<string> {
  // Hole alle aktiven Mietverträge mit Mietern und Einheiten
  const { data: contracts, error } = await supabase
    .from("mietvertrag")
    .select(`
      id,
      kaltmiete,
      betriebskosten,
      kaution_betrag,
      bankkonto_mieter,
      weitere_bankkonten,
      verwendungszweck,
      status,
      einheit_id,
      einheiten!inner (
        id,
        etage,
        immobilie_id,
        immobilien!inner (
          id,
          name,
          adresse
        )
      ),
      mietvertrag_mieter (
        mieter (
          id,
          vorname,
          nachname
        )
      )
    `)
    .in("status", ["aktiv", "gekuendigt"]);

  if (error) {
    console.error("Error fetching contracts:", error);
    return "Keine Vertragsdaten verfügbar";
  }

  // Formatiere die Vertragsdaten für den AI-Kontext
  const contractInfo = contracts.map((c: any) => {
    const mieter = c.mietvertrag_mieter?.map((mm: any) => 
      `${mm.mieter?.vorname || ""} ${mm.mieter?.nachname || ""}`.trim()
    ).filter(Boolean).join(", ") || "Unbekannt";
    
    const immobilie = c.einheiten?.immobilien;
    const gesamtmiete = (c.kaltmiete || 0) + (c.betriebskosten || 0);
    
    return {
      id: c.id,
      mieter,
      gesamtmiete,
      kaution: c.kaution_betrag,
      iban: c.bankkonto_mieter,
      weitere_iban: c.weitere_bankkonten,
      verwendungszweck: c.verwendungszweck,
      immobilie: immobilie ? `${immobilie.name}, ${immobilie.adresse}` : "Unbekannt",
      etage: c.einheiten?.etage,
      status: c.status
    };
  });

  return JSON.stringify(contractInfo, null, 2);
}

async function processRuecklastschrift(
  payment: Payment, 
  contractContext: string
): Promise<ProcessedPayment> {
  const systemPrompt = `Du bist ein Experte für die Zuordnung von Rücklastschriften in einer Immobilienverwaltung.

KONTEXT - Aktive Mietverträge:
${contractContext}

AUFGABE:
Analysiere die Rücklastschrift und finde den zugehörigen Mietvertrag.
- Suche im Verwendungszweck nach Hinweisen auf Objekt, Einheit oder Mietername
- Die Original-Lastschrift wurde vom Mieterkonto eingezogen und dann zurückgebucht
- Kategorie ist IMMER "Rücklastschrift"`;

  const userPrompt = `Rücklastschrift analysieren:
- Betrag: ${payment.betrag} €
- IBAN: ${payment.iban}
- Verwendungszweck: ${payment.verwendungszweck}
- Empfänger: ${payment.empfaengername || "N/A"}
- Datum: ${payment.buchungsdatum}`;

  try {
    const result = await callAI(systemPrompt, userPrompt);
    return {
      ...payment,
      mietvertrag_id: result.mietvertrag_id || null,
      kategorie: "Rücklastschrift",
      zuordnungsgrund: result.zuordnungsgrund,
      confidence: result.confidence
    };
  } catch (error) {
    console.error("Rücklastschrift AI Error:", error);
    return {
      ...payment,
      mietvertrag_id: null,
      kategorie: "Rücklastschrift",
      zuordnungsgrund: "AI-Fehler bei Zuordnung",
      confidence: 0
    };
  }
}

async function processBGZahlung(
  payment: Payment, 
  contractContext: string
): Promise<ProcessedPayment> {
  const systemPrompt = `Du bist ein Experte für die Zuordnung von BG-Zahlungen (Bürgergeld/Jobcenter) in einer Immobilienverwaltung.

KONTEXT - Aktive Mietverträge:
${contractContext}

AUFGABE:
Analysiere die Zahlung vom Jobcenter/Sozialamt und ordne sie dem richtigen Mieter zu.
- Extrahiere den Mieternamen aus dem Verwendungszweck
- Vergleiche mit den Mieternamen in den Verträgen
- Prüfe ob der Betrag zur Miete oder Kaution passt
- Bei "Kaution" im Verwendungszweck UND passendem Betrag → "Mietkaution"
- Sonst → "Miete"`;

  const userPrompt = `BG-Zahlung (Jobcenter) analysieren:
- Betrag: ${payment.betrag} €
- Verwendungszweck: ${payment.verwendungszweck}
- Datum: ${payment.buchungsdatum}

Finde den passenden Mieter und kategorisiere die Zahlung.`;

  try {
    const result = await callAI(systemPrompt, userPrompt);
    return {
      ...payment,
      mietvertrag_id: result.mietvertrag_id || null,
      kategorie: result.kategorie || "Miete",
      zuordnungsgrund: result.zuordnungsgrund,
      confidence: result.confidence
    };
  } catch (error) {
    console.error("BG-Zahlung AI Error:", error);
    return {
      ...payment,
      mietvertrag_id: null,
      kategorie: "Miete",
      zuordnungsgrund: "AI-Fehler bei Zuordnung",
      confidence: 0
    };
  }
}

async function processStandardPayment(
  payment: Payment, 
  contractContext: string
): Promise<ProcessedPayment> {
  const systemPrompt = `Du bist ein Experte für die Zuordnung von Mietzahlungen in einer Immobilienverwaltung.

KONTEXT - Aktive Mietverträge:
${contractContext}

AUFGABE:
Ordne die Zahlung dem richtigen Mietvertrag zu.

PRIORISIERTE ZUORDNUNGSLOGIK:
1. IBAN-Match: Vergleiche payment.iban mit bankkonto_mieter oder weitere_iban
2. Verwendungszweck-Match: Suche nach dem Mietvertrag-verwendungszweck im Payment-Verwendungszweck
3. Namens-Match: Suche nach Mieternamen im Verwendungszweck oder Empfängername
4. Betrags-Match: Vergleiche mit gesamtmiete (Toleranz ±5€)

KATEGORISIERUNG:
- "Mietkaution": NUR wenn "Kaution" explizit im Verwendungszweck UND Betrag passt zum kaution_betrag
- "Miete": Wenn Betrag zur monatlichen Miete passt
- "Nichtmiete": Bei Unklarheit oder anderen Zahlungsarten

WICHTIG: Im Zweifel eher "Miete" als "Mietkaution" wählen!`;

  const userPrompt = `Zahlung analysieren:
- Betrag: ${payment.betrag} €
- IBAN: ${payment.iban}
- Verwendungszweck: ${payment.verwendungszweck}
- Empfänger/Auftraggeber: ${payment.empfaengername || "N/A"}
- Datum: ${payment.buchungsdatum}

Finde den passenden Mietvertrag und kategorisiere die Zahlung.`;

  try {
    const result = await callAI(systemPrompt, userPrompt);
    return {
      ...payment,
      mietvertrag_id: result.mietvertrag_id || null,
      kategorie: result.kategorie || "Nichtmiete",
      zuordnungsgrund: result.zuordnungsgrund,
      confidence: result.confidence
    };
  } catch (error) {
    console.error("Standard Payment AI Error:", error);
    return {
      ...payment,
      mietvertrag_id: null,
      kategorie: "Nichtmiete",
      zuordnungsgrund: "AI-Fehler bei Zuordnung",
      confidence: 0
    };
  }
}

function categorizePaymentType(payment: Payment): "retoure" | "utility" | "bg_zahlung" | "standard" {
  const verwendungszweck = payment.verwendungszweck?.toLowerCase() || "";
  
  // Rücklastschrift erkennen
  if (verwendungszweck.includes("retoure") || verwendungszweck.includes("rücklastschrift")) {
    return "retoure";
  }
  
  // Versorgungskosten erkennen
  if (UTILITY_KEYWORDS.some(keyword => verwendungszweck.includes(keyword))) {
    return "utility";
  }
  
  // BG-Zahlung (Jobcenter) erkennen
  if (payment.iban === BG_ZAHLUNG_IBAN) {
    return "bg_zahlung";
  }
  
  return "standard";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { payments, dryRun = true } = await req.json();

    if (!payments || !Array.isArray(payments)) {
      return new Response(
        JSON.stringify({ error: "payments Array erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received ${payments.length} payments (dryRun: ${dryRun})`);

    // ============= DUPLIKATSPRÜFUNG =============
    // Prüfe jede Zahlung auf Existenz in der DB (anhand Betrag, IBAN, Datum, Verwendungszweck)
    const duplicateChecks = await Promise.all(
      payments.map(async (payment: Payment) => {
        const { data: existing } = await supabase
          .from("zahlungen")
          .select("id")
          .eq("betrag", payment.betrag)
          .eq("iban", payment.iban)
          .eq("buchungsdatum", payment.buchungsdatum)
          .eq("verwendungszweck", payment.verwendungszweck)
          .limit(1);
        
        return {
          payment,
          isDuplicate: existing && existing.length > 0,
          existingId: existing?.[0]?.id || null
        };
      })
    );

    const newPayments = duplicateChecks.filter(c => !c.isDuplicate).map(c => c.payment);
    const duplicates = duplicateChecks.filter(c => c.isDuplicate).map(c => ({
      ...c.payment,
      existingId: c.existingId
    }));

    console.log(`Duplikatsprüfung: ${newPayments.length} neue, ${duplicates.length} bereits vorhanden`);

    // Falls keine neuen Zahlungen, gib früh zurück
    if (newPayments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun,
          stats: {
            total: payments.length,
            neue: 0,
            duplikate: duplicates.length,
            zugeordnet: 0,
            nicht_zugeordnet: 0,
            nach_kategorie: { miete: 0, mietkaution: 0, ruecklastschrift: 0, nichtmiete: 0 },
            durchschnittliche_konfidenz: 0
          },
          results: [],
          duplicates
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hole Vertragskontext einmal für alle
    const contractContext = await getContractContext(supabase);

    const results: ProcessedPayment[] = [];

    // Verarbeite nur NEUE Zahlungen (keine Duplikate)
    for (const payment of newPayments) {
      const paymentType = categorizePaymentType(payment);
      let processed: ProcessedPayment;

      console.log(`Payment: ${payment.betrag}€, Type: ${paymentType}`);

      switch (paymentType) {
        case "retoure":
          processed = await processRuecklastschrift(payment, contractContext);
          break;
        case "bg_zahlung":
          processed = await processBGZahlung(payment, contractContext);
          break;
        case "utility":
          // Versorgungskosten werden als Nichtmiete kategorisiert
          processed = {
            ...payment,
            mietvertrag_id: null,
            kategorie: "Nichtmiete",
            zuordnungsgrund: "Versorgungskosten (automatisch erkannt)",
            confidence: 100
          };
          break;
        default:
          processed = await processStandardPayment(payment, contractContext);
      }

      results.push(processed);

      // Rate-limiting: 500ms Pause zwischen AI-Calls
      if (paymentType !== "utility") {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Optional: In DB speichern wenn nicht dryRun
    if (!dryRun) {
      for (const result of results) {
        if (result.mietvertrag_id) {
          const { error } = await supabase
            .from("zahlungen")
            .update({
              mietvertrag_id: result.mietvertrag_id,
              kategorie: result.kategorie
            })
            .eq("buchungsdatum", result.buchungsdatum)
            .eq("betrag", result.betrag)
            .eq("iban", result.iban);

          if (error) {
            console.error("DB Update Error:", error);
          }
        }
      }
    }

    // Statistiken erstellen
    const stats = {
      total: payments.length,
      neue: newPayments.length,
      duplikate: duplicates.length,
      zugeordnet: results.filter(r => r.mietvertrag_id).length,
      nicht_zugeordnet: results.filter(r => !r.mietvertrag_id).length,
      nach_kategorie: {
        miete: results.filter(r => r.kategorie === "Miete").length,
        mietkaution: results.filter(r => r.kategorie === "Mietkaution").length,
        ruecklastschrift: results.filter(r => r.kategorie === "Rücklastschrift").length,
        nichtmiete: results.filter(r => r.kategorie === "Nichtmiete").length,
      },
      durchschnittliche_konfidenz: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
        : 0
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        dryRun,
        stats,
        results,
        duplicates
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("process-payments error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
