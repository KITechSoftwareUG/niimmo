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

interface ContractInfo {
  id: string;
  mieter: string;
  gesamtmiete: number;
  kaution: number | null;
  iban: string | null;
  weitere_iban: string | null;
  verwendungszweck: string[] | null;
  immobilie: string;
  etage: string | null;
  status: string;
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

async function getContractContext(supabase: any): Promise<ContractInfo[]> {
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
    return [];
  }

  return contracts.map((c: any) => {
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
}

// Rule-based matching without AI - fast and reliable
function matchPaymentByRules(payment: Payment, contracts: ContractInfo[]): ProcessedPayment | null {
  const verwendungszweck = payment.verwendungszweck?.toLowerCase() || "";
  const empfaenger = payment.empfaengername?.toLowerCase() || "";
  
  // 1. IBAN-Match (highest priority)
  for (const contract of contracts) {
    if (contract.iban && payment.iban === contract.iban) {
      const isKaution = verwendungszweck.includes("kaution") && 
                        contract.kaution && 
                        Math.abs(payment.betrag - contract.kaution) < 5;
      return {
        ...payment,
        mietvertrag_id: contract.id,
        kategorie: isKaution ? "Mietkaution" : "Miete",
        zuordnungsgrund: `IBAN-Match: ${contract.mieter}`,
        confidence: 95
      };
    }
    
    // Check weitere_bankkonten (could be comma-separated)
    if (contract.weitere_iban) {
      const weitereIbans = contract.weitere_iban.split(',').map(i => i.trim());
      if (weitereIbans.includes(payment.iban)) {
        const isKaution = verwendungszweck.includes("kaution") && 
                          contract.kaution && 
                          Math.abs(payment.betrag - contract.kaution) < 5;
        return {
          ...payment,
          mietvertrag_id: contract.id,
          kategorie: isKaution ? "Mietkaution" : "Miete",
          zuordnungsgrund: `Weitere IBAN-Match: ${contract.mieter}`,
          confidence: 90
        };
      }
    }
  }
  
  // 2. Verwendungszweck-Match (check if contract's verwendungszweck is in payment)
  for (const contract of contracts) {
    if (contract.verwendungszweck && Array.isArray(contract.verwendungszweck)) {
      for (const vzweck of contract.verwendungszweck) {
        if (vzweck && verwendungszweck.includes(vzweck.toLowerCase())) {
          const isKaution = verwendungszweck.includes("kaution") && 
                            contract.kaution && 
                            Math.abs(payment.betrag - contract.kaution) < 5;
          return {
            ...payment,
            mietvertrag_id: contract.id,
            kategorie: isKaution ? "Mietkaution" : "Miete",
            zuordnungsgrund: `Verwendungszweck-Match: "${vzweck}" für ${contract.mieter}`,
            confidence: 85
          };
        }
      }
    }
  }
  
  // 3. Name-Match (check if tenant name appears in verwendungszweck or empfänger)
  for (const contract of contracts) {
    const mieterNames = contract.mieter.toLowerCase().split(",").map(n => n.trim());
    
    for (const name of mieterNames) {
      if (name.length > 3) { // Avoid matching short names like "Max"
        const nameParts = name.split(" ").filter(p => p.length > 2);
        
        // Check if last name (usually more unique) is in verwendungszweck or empfänger
        const lastName = nameParts[nameParts.length - 1];
        if (lastName && (verwendungszweck.includes(lastName) || empfaenger.includes(lastName))) {
          const isKaution = verwendungszweck.includes("kaution") && 
                            contract.kaution && 
                            Math.abs(payment.betrag - contract.kaution) < 5;
          return {
            ...payment,
            mietvertrag_id: contract.id,
            kategorie: isKaution ? "Mietkaution" : "Miete",
            zuordnungsgrund: `Namen-Match: "${lastName}" für ${contract.mieter}`,
            confidence: 75
          };
        }
      }
    }
  }
  
  // 4. Amount-Match with tolerance (only if unique match)
  const amountMatches = contracts.filter(c => 
    Math.abs(c.gesamtmiete - payment.betrag) < 5 && payment.betrag > 0
  );
  
  if (amountMatches.length === 1) {
    const contract = amountMatches[0];
    const isKaution = verwendungszweck.includes("kaution") && 
                      contract.kaution && 
                      Math.abs(payment.betrag - contract.kaution) < 5;
    return {
      ...payment,
      mietvertrag_id: contract.id,
      kategorie: isKaution ? "Mietkaution" : "Miete",
      zuordnungsgrund: `Betrags-Match (eindeutig): ${contract.gesamtmiete}€ für ${contract.mieter}`,
      confidence: 60
    };
  }
  
  return null;
}

// Process BG-Zahlung (Jobcenter) with AI
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
      zuordnungsgrund: "AI-Fehler bei BG-Zahlung",
      confidence: 0
    };
  }
}

// Process Rücklastschrift with AI
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
      zuordnungsgrund: "AI-Fehler bei Rücklastschrift",
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
    // Use RPC call with TRIM for better matching (handles whitespace differences)
    const duplicateChecks = await Promise.all(
      payments.map(async (payment: Payment) => {
        // Normalize values for comparison
        const betrag = payment.betrag;
        const iban = payment.iban?.trim() || '';
        const buchungsdatum = payment.buchungsdatum;
        const verwendungszweck = payment.verwendungszweck?.trim() || '';
        
        // Query with trimmed comparison using ilike for fuzzy matching
        const { data: existing } = await supabase
          .from("zahlungen")
          .select("id, verwendungszweck")
          .eq("betrag", betrag)
          .eq("buchungsdatum", buchungsdatum)
          .limit(50); // Get more to check manually
        
        // Manual comparison with trimming
        const match = existing?.find(row => {
          const dbIban = (row as any).iban?.trim() || '';
          const dbVz = (row as any).verwendungszweck?.trim() || '';
          // Note: iban is not in select, need to add it
          return dbVz === verwendungszweck;
        });
        
        // Fallback: Re-query with iban included
        const { data: existingFull } = await supabase
          .from("zahlungen")
          .select("id, iban, verwendungszweck")
          .eq("betrag", betrag)
          .eq("buchungsdatum", buchungsdatum)
          .limit(50);
        
        const matchFull = existingFull?.find(row => {
          const dbIban = row.iban?.trim() || '';
          const dbVz = row.verwendungszweck?.trim() || '';
          return dbIban === iban && dbVz === verwendungszweck;
        });
        
        return {
          payment,
          isDuplicate: !!matchFull,
          existingId: matchFull?.id || null
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

    // Hole Vertragskontext
    const contracts = await getContractContext(supabase);
    const contractContextString = JSON.stringify(contracts, null, 2);

    const results: ProcessedPayment[] = [];
    const needsAI: { payment: Payment; type: string }[] = [];

    // PHASE 1: Fast rule-based matching (no AI)
    for (const payment of newPayments) {
      const paymentType = categorizePaymentType(payment);
      
      if (paymentType === "utility") {
        // Versorgungskosten - automatisch kategorisieren
        results.push({
          ...payment,
          mietvertrag_id: null,
          kategorie: "Nichtmiete",
          zuordnungsgrund: "Versorgungskosten (automatisch erkannt)",
          confidence: 100
        });
      } else if (paymentType === "retoure") {
        // Rücklastschrift - versuche erst Regel-Matching
        const ruleMatch = matchPaymentByRules(payment, contracts);
        if (ruleMatch) {
          results.push({
            ...ruleMatch,
            kategorie: "Rücklastschrift",
            zuordnungsgrund: `Rücklastschrift: ${ruleMatch.zuordnungsgrund}`
          });
        } else {
          needsAI.push({ payment, type: "retoure" });
        }
      } else if (paymentType === "bg_zahlung") {
        // BG-Zahlung - braucht AI wegen komplexer Namensextraktion
        needsAI.push({ payment, type: "bg_zahlung" });
      } else {
        // Standard: Erst Regel-Matching versuchen
        const ruleMatch = matchPaymentByRules(payment, contracts);
        if (ruleMatch) {
          results.push(ruleMatch);
        } else {
          // Negative Beträge ohne Match → Nichtmiete
          if (payment.betrag < 0) {
            results.push({
              ...payment,
              mietvertrag_id: null,
              kategorie: "Nichtmiete",
              zuordnungsgrund: "Abbuchung ohne Vertragszuordnung",
              confidence: 50
            });
          } else {
            needsAI.push({ payment, type: "standard" });
          }
        }
      }
    }

    console.log(`Rule-based: ${results.length} matched, ${needsAI.length} need AI`);

    // PHASE 2: AI processing for unmatched payments (limited batch)
    const MAX_AI_CALLS = 20; // Limit AI calls to prevent timeout
    const aiQueue = needsAI.slice(0, MAX_AI_CALLS);
    const skippedAI = needsAI.slice(MAX_AI_CALLS);

    for (const { payment, type } of aiQueue) {
      let processed: ProcessedPayment;
      
      console.log(`AI Processing: ${payment.betrag}€, Type: ${type}`);
      
      if (type === "bg_zahlung") {
        processed = await processBGZahlung(payment, contractContextString);
      } else if (type === "retoure") {
        processed = await processRuecklastschrift(payment, contractContextString);
      } else {
        // For standard payments that couldn't be rule-matched, mark as unknown
        processed = {
          ...payment,
          mietvertrag_id: null,
          kategorie: "Nichtmiete",
          zuordnungsgrund: "Keine automatische Zuordnung möglich",
          confidence: 0
        };
      }
      
      results.push(processed);
      
      // Small delay between AI calls
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Add skipped payments as unprocessed
    for (const { payment } of skippedAI) {
      results.push({
        ...payment,
        mietvertrag_id: null,
        kategorie: "Nichtmiete",
        zuordnungsgrund: "Nicht verarbeitet (Batch-Limit)",
        confidence: 0
      });
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
