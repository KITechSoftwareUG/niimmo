import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BG-Zahlung IBAN (Jobcenter/Sozialamt - immer gleiche IBAN vom Staat)
const BG_ZAHLUNG_IBAN = "DE94760000000076001601";

// ============= INTERFACES =============

interface Payment {
  buchungsdatum: string;
  wertstellungsdatum?: string;
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
  selected?: boolean; // For UI checkbox state
}

interface ContractInfo {
  id: string;
  mieter: string;
  mieterNamen: string[]; // Array of individual names for fuzzy matching
  gesamtmiete: number;
  kaution: number | null;
  iban: string | null;
  weitere_iban: string | null;
  verwendungszweck: string[] | null;
  immobilie: string;
  etage: string | null;
  status: string;
}

interface NichtmieteRegel {
  id: string;
  regel_typ: "empfaenger_contains" | "empfaenger_equals" | "iban_equals" | "verwendungszweck_contains";
  wert: string;
  beschreibung: string | null;
  aktiv: boolean;
}

// ============= FUZZY MATCHING (Levenshtein Distance) =============

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzyMatch(text: string, searchTerm: string, maxDistance: number = 1): boolean {
  if (!text || !searchTerm) return false;
  
  // Require minimum 4 characters for matching to avoid false positives
  if (searchTerm.length < 4) return false;
  
  const textLower = text.toLowerCase();
  const searchLower = searchTerm.toLowerCase();
  
  // Exact substring match - this is reliable
  if (textLower.includes(searchLower)) return true;
  
  // For fuzzy matching, be MUCH more strict to avoid false positives
  // Only allow fuzzy match for longer names (6+ chars) with max 1 distance
  if (searchLower.length < 6) return false;
  
  // Split into words and check each - require near-exact match
  const words = textLower.split(/\s+/);
  for (const word of words) {
    // Word must be similar length to search term (±2 chars)
    if (Math.abs(word.length - searchLower.length) > 2) continue;
    
    if (word.length >= 5 && searchLower.length >= 5) {
      const distance = levenshteinDistance(word, searchLower);
      // Much stricter: only allow 1 character difference for names 6+ chars
      if (distance <= maxDistance) return true;
    }
  }
  
  return false;
}

// ============= AI CALL =============

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

// ============= DB CONTEXT LOADING =============

async function getNichtmieteRegeln(supabase: any): Promise<NichtmieteRegel[]> {
  const { data, error } = await supabase
    .from("nichtmiete_regeln")
    .select("*")
    .eq("aktiv", true);
  
  if (error) {
    console.error("Error fetching nichtmiete_regeln:", error);
    return [];
  }
  
  return data || [];
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
    const mieterNames: string[] = [];
    const mieterDisplay: string[] = [];
    
    c.mietvertrag_mieter?.forEach((mm: any) => {
      const vorname = mm.mieter?.vorname || "";
      const nachname = mm.mieter?.nachname || "";
      const fullName = `${vorname} ${nachname}`.trim();
      if (fullName) {
        mieterDisplay.push(fullName);
        // Add individual parts for fuzzy matching
        if (vorname) mieterNames.push(vorname.toLowerCase());
        if (nachname) mieterNames.push(nachname.toLowerCase());
      }
    });
    
    const immobilie = c.einheiten?.immobilien;
    const gesamtmiete = (c.kaltmiete || 0) + (c.betriebskosten || 0);
    
    return {
      id: c.id,
      mieter: mieterDisplay.join(", ") || "Unbekannt",
      mieterNamen: mieterNames,
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

// ============= CATEGORIZATION WITH DB RULES =============

function categorizePaymentType(
  payment: Payment, 
  regeln: NichtmieteRegel[]
): "retoure" | "nichtmiete" | "bg_zahlung" | "standard" {
  const verwendungszweck = payment.verwendungszweck || "";
  const empfaenger = payment.empfaengername || "";
  
  // 1. BG-Zahlung (Jobcenter) - IBAN-Match hat höchste Priorität
  if (payment.iban === BG_ZAHLUNG_IBAN) {
    return "bg_zahlung";
  }
  
  // 2. Check DB rules
  for (const regel of regeln) {
    switch (regel.regel_typ) {
      case "verwendungszweck_contains":
        // Special case: Rücklastschrift detection
        if (verwendungszweck.includes(regel.wert)) {
          if (regel.wert.toLowerCase().includes("retoure") || 
              regel.wert.toLowerCase().includes("rücklastschrift") ||
              regel.wert.toLowerCase().includes("lastschrift")) {
            return "retoure";
          }
          return "nichtmiete";
        }
        break;
      case "empfaenger_contains":
        if (empfaenger.includes(regel.wert)) {
          return "nichtmiete";
        }
        break;
      case "empfaenger_equals":
        if (empfaenger === regel.wert) {
          return "nichtmiete";
        }
        break;
      case "iban_equals":
        if (payment.iban === regel.wert) {
          return "nichtmiete";
        }
        break;
    }
  }
  
  return "standard";
}

// ============= RULE-BASED MATCHING =============

const BETRAG_TOLERANZ = 5; // ±5€ tolerance

function matchPaymentByRules(payment: Payment, contracts: ContractInfo[]): ProcessedPayment | null {
  const verwendungszweck = payment.verwendungszweck?.toLowerCase() || "";
  const empfaenger = payment.empfaengername?.toLowerCase() || "";
  
  // 1. IBAN-Match (highest priority - includes weitere_bankkonten)
  for (const contract of contracts) {
    // Primary IBAN
    if (contract.iban && payment.iban === contract.iban) {
      const isKaution = verwendungszweck.includes("kaution") && 
                        contract.kaution && 
                        Math.abs(payment.betrag - contract.kaution) <= BETRAG_TOLERANZ;
      return {
        ...payment,
        mietvertrag_id: contract.id,
        kategorie: isKaution ? "Mietkaution" : "Miete",
        zuordnungsgrund: `IBAN-Match: ${contract.mieter}`,
        confidence: 95,
        selected: true
      };
    }
    
    // Weitere Bankkonten (comma-separated)
    if (contract.weitere_iban) {
      const weitereIbans = contract.weitere_iban.split(',').map(i => i.trim());
      if (weitereIbans.includes(payment.iban)) {
        const isKaution = verwendungszweck.includes("kaution") && 
                          contract.kaution && 
                          Math.abs(payment.betrag - contract.kaution) <= BETRAG_TOLERANZ;
        return {
          ...payment,
          mietvertrag_id: contract.id,
          kategorie: isKaution ? "Mietkaution" : "Miete",
          zuordnungsgrund: `Weitere IBAN-Match: ${contract.mieter}`,
          confidence: 90,
          selected: true
        };
      }
    }
  }
  
  // 2. Verwendungszweck-Match (contract's keywords in payment)
  for (const contract of contracts) {
    if (contract.verwendungszweck && Array.isArray(contract.verwendungszweck)) {
      for (const vzweck of contract.verwendungszweck) {
        if (vzweck && verwendungszweck.includes(vzweck.toLowerCase())) {
          const isKaution = verwendungszweck.includes("kaution") && 
                            contract.kaution && 
                            Math.abs(payment.betrag - contract.kaution) <= BETRAG_TOLERANZ;
          return {
            ...payment,
            mietvertrag_id: contract.id,
            kategorie: isKaution ? "Mietkaution" : "Miete",
            zuordnungsgrund: `Verwendungszweck-Match: "${vzweck}" für ${contract.mieter}`,
            confidence: 85,
            selected: true
          };
        }
      }
    }
  }
  
  // 3. STRICT Name-Match (tenant name in verwendungszweck or empfänger)
  // Only match if BOTH first and last name parts are found, or exact full name match
  for (const contract of contracts) {
    const mieterNamen = contract.mieterNamen;
    
    // Skip if no names available
    if (!mieterNamen || mieterNamen.length === 0) continue;
    
    // For each name, require EXACT substring match (no fuzzy for names)
    let matchedParts = 0;
    let matchedName = "";
    
    for (const name of mieterNamen) {
      // Require minimum 4 characters for name matching
      if (name.length < 4) continue;
      
      // EXACT substring match only - no fuzzy matching for names
      if (verwendungszweck.includes(name) || empfaenger.includes(name)) {
        matchedParts++;
        matchedName = name;
      }
    }
    
    // Require at least 2 name parts matched (e.g., first AND last name)
    // OR one very distinctive name (7+ chars) that's unlikely to be coincidental
    if (matchedParts >= 2 || (matchedParts === 1 && matchedName.length >= 7)) {
      const isKaution = verwendungszweck.includes("kaution") && 
                        contract.kaution && 
                        Math.abs(payment.betrag - contract.kaution) <= BETRAG_TOLERANZ;
      return {
        ...payment,
        mietvertrag_id: contract.id,
        kategorie: isKaution ? "Mietkaution" : "Miete",
        zuordnungsgrund: `Namen-Match: "${matchedName}" für ${contract.mieter}`,
        confidence: matchedParts >= 2 ? 85 : 70,
        selected: true
      };
    }
  }
  
  // 4. Amount-Match with tolerance (only if unique match)
  const amountMatches = contracts.filter(c => 
    Math.abs(c.gesamtmiete - payment.betrag) <= BETRAG_TOLERANZ && payment.betrag > 0
  );
  
  if (amountMatches.length === 1) {
    const contract = amountMatches[0];
    const isKaution = verwendungszweck.includes("kaution") && 
                      contract.kaution && 
                      Math.abs(payment.betrag - contract.kaution) <= BETRAG_TOLERANZ;
    return {
      ...payment,
      mietvertrag_id: contract.id,
      kategorie: isKaution ? "Mietkaution" : "Miete",
      zuordnungsgrund: `Betrags-Match (eindeutig ±${BETRAG_TOLERANZ}€): ${contract.gesamtmiete}€ für ${contract.mieter}`,
      confidence: 60,
      selected: true
    };
  }
  
  return null;
}

// ============= AI PROCESSING =============

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
      confidence: result.confidence,
      selected: true
    };
  } catch (error) {
    console.error("BG-Zahlung AI Error:", error);
    return {
      ...payment,
      mietvertrag_id: null,
      kategorie: "Miete",
      zuordnungsgrund: "AI-Fehler bei BG-Zahlung",
      confidence: 0,
      selected: false
    };
  }
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
      confidence: result.confidence,
      selected: true
    };
  } catch (error) {
    console.error("Rücklastschrift AI Error:", error);
    return {
      ...payment,
      mietvertrag_id: null,
      kategorie: "Rücklastschrift",
      zuordnungsgrund: "AI-Fehler bei Rücklastschrift",
      confidence: 0,
      selected: false
    };
  }
}

// ============= MAIN HANDLER =============

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

    // Load DB rules and contracts in parallel
    const [nichtmieteRegeln, contracts] = await Promise.all([
      getNichtmieteRegeln(supabase),
      getContractContext(supabase)
    ]);
    
    console.log(`Loaded ${nichtmieteRegeln.length} Nichtmiete-Regeln, ${contracts.length} contracts`);
    const contractContextString = JSON.stringify(contracts, null, 2);

    // ============= DUPLIKATSPRÜFUNG =============
    const duplicateChecks = await Promise.all(
      payments.map(async (payment: Payment) => {
        const betrag = payment.betrag;
        const iban = payment.iban?.trim() || "";
        const verwendungszweck = payment.verwendungszweck?.trim() || "";

        const candidateDates = Array.from(
          new Set([payment.buchungsdatum, payment.wertstellungsdatum].filter(Boolean) as string[])
        );

        let match: { id: string; iban: string | null; verwendungszweck: string | null; buchungsdatum: string } | undefined;

        if (candidateDates.length > 0) {
          const { data } = await supabase
            .from("zahlungen")
            .select("id, iban, verwendungszweck, buchungsdatum")
            .eq("betrag", betrag)
            .in("buchungsdatum", candidateDates)
            .limit(50);

          const rows = (data as any[]) ?? [];
          match = rows.find((row) => {
            const dbIban = (row.iban ?? "").toString().trim();
            const dbVz = (row.verwendungszweck ?? "").toString().trim();
            return dbIban === iban && dbVz === verwendungszweck;
          });
        }

        // Fallback: date drift ±5 days
        if (!match && payment.buchungsdatum) {
          const base = new Date(`${payment.buchungsdatum}T00:00:00Z`);
          if (!Number.isNaN(base.getTime())) {
            const from = new Date(base);
            from.setUTCDate(from.getUTCDate() - 5);
            const to = new Date(base);
            to.setUTCDate(to.getUTCDate() + 5);

            const fromIso = from.toISOString().slice(0, 10);
            const toIso = to.toISOString().slice(0, 10);

            const { data } = await supabase
              .from("zahlungen")
              .select("id, iban, verwendungszweck, buchungsdatum")
              .eq("betrag", betrag)
              .gte("buchungsdatum", fromIso)
              .lte("buchungsdatum", toIso)
              .limit(200);

            const rows = (data as any[]) ?? [];
            match = rows.find((row) => {
              const dbIban = (row.iban ?? "").toString().trim();
              const dbVz = (row.verwendungszweck ?? "").toString().trim();
              return dbIban === iban && dbVz === verwendungszweck;
            });
          }
        }

        return {
          payment,
          isDuplicate: !!match,
          existingId: match?.id || null,
        };
      })
    );

    const newPayments = duplicateChecks.filter(c => !c.isDuplicate).map(c => c.payment);
    const duplicates = duplicateChecks.filter(c => c.isDuplicate).map(c => ({
      ...c.payment,
      existingId: c.existingId
    }));

    console.log(`Duplikatsprüfung: ${newPayments.length} neue, ${duplicates.length} bereits vorhanden`);

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

    const results: ProcessedPayment[] = [];
    const needsAI: { payment: Payment; type: string }[] = [];

    // PHASE 1: Fast rule-based matching
    for (const payment of newPayments) {
      const paymentType = categorizePaymentType(payment, nichtmieteRegeln);
      
      if (paymentType === "nichtmiete") {
        results.push({
          ...payment,
          mietvertrag_id: null,
          kategorie: "Nichtmiete",
          zuordnungsgrund: `DB-Regel: Empfänger/Verwendungszweck als Versorger/Darlehen erkannt`,
          confidence: 100,
          selected: true
        });
      } else if (paymentType === "retoure") {
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
        needsAI.push({ payment, type: "bg_zahlung" });
      } else {
        const ruleMatch = matchPaymentByRules(payment, contracts);
        if (ruleMatch) {
          results.push(ruleMatch);
        } else {
          if (payment.betrag < 0) {
            results.push({
              ...payment,
              mietvertrag_id: null,
              kategorie: "Nichtmiete",
              zuordnungsgrund: "Abbuchung ohne Vertragszuordnung",
              confidence: 50,
              selected: true
            });
          } else {
            needsAI.push({ payment, type: "standard" });
          }
        }
      }
    }

    console.log(`Rule-based: ${results.length} matched, ${needsAI.length} need AI`);

    // PHASE 2: AI processing (limited batch)
    const MAX_AI_CALLS = 20;
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
        processed = {
          ...payment,
          mietvertrag_id: null,
          kategorie: "Nichtmiete",
          zuordnungsgrund: "Keine automatische Zuordnung möglich",
          confidence: 0,
          selected: false
        };
      }
      
      results.push(processed);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    for (const { payment } of skippedAI) {
      results.push({
        ...payment,
        mietvertrag_id: null,
        kategorie: "Nichtmiete",
        zuordnungsgrund: "Nicht verarbeitet (Batch-Limit)",
        confidence: 0,
        selected: false
      });
    }

    // Optional: Save to DB if not dryRun
    if (!dryRun) {
      for (const result of results) {
        if (result.mietvertrag_id && result.selected !== false) {
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

    // Statistics
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
