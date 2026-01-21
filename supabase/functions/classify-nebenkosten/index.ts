import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Zahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string | null;
  empfaengername: string | null;
  iban: string | null;
  kategorie: string | null;
  immobilie_id: string | null;
}

interface Immobilie {
  id: string;
  name: string;
  adresse: string;
}

interface ClassificationResult {
  zahlung_id: string;
  is_betriebskosten: boolean;
  confidence: "high" | "medium" | "low";
  category: string;
  suggested_immobilie_id: string | null;
  suggested_immobilie_name: string | null;
  reasoning: string;
  zahlung?: Zahlung;
}

// Regex patterns for filtering and classification
const EXCLUDE_PATTERNS = [
  /darlehen/i,
  /kredit/i,
  /tilgung/i,
  /zins(en)?/i,
  /bank\s*(geb|entgelt)/i,
  /kontoführung/i,
  /sollzins/i,
  /habenzins/i,
  /annuität/i,
  /hypothek/i,
  /baufinanzierung/i,
  /ratenkredit/i,
  /immobilienfinanzierung/i,
];

// Known utility providers - direct classification without AI
const BETRIEBSKOSTEN_PATTERNS: { pattern: RegExp; category: string }[] = [
  // Strom
  { pattern: /avacon/i, category: "Strom" },
  { pattern: /evi\s+energie/i, category: "Strom" },
  { pattern: /stadtwerk.*strom/i, category: "Strom" },
  { pattern: /enercity/i, category: "Strom" },
  { pattern: /e\.on/i, category: "Strom" },
  { pattern: /vattenfall/i, category: "Strom" },
  { pattern: /rwe/i, category: "Strom" },
  { pattern: /ewe.*strom/i, category: "Strom" },
  
  // Gas/Heizung
  { pattern: /stadtwerk.*gas/i, category: "Gas" },
  { pattern: /ewe.*gas/i, category: "Gas" },
  { pattern: /heizöl/i, category: "Heizung" },
  { pattern: /brennstoff/i, category: "Heizung" },
  { pattern: /fernwärme/i, category: "Heizung" },
  
  // Wasser/Abwasser
  { pattern: /wasserzweckverband/i, category: "Wasser" },
  { pattern: /wasserwerk/i, category: "Wasser" },
  { pattern: /wasserverband/i, category: "Wasser" },
  { pattern: /stadtwerk.*wasser/i, category: "Wasser" },
  { pattern: /abwasser/i, category: "Abwasser" },
  { pattern: /entwässerung/i, category: "Abwasser" },
  { pattern: /kanal(isation)?/i, category: "Abwasser" },
  
  // Müll
  { pattern: /müll/i, category: "Müll" },
  { pattern: /abfall/i, category: "Müll" },
  { pattern: /entsorgung/i, category: "Müll" },
  { pattern: /aha.*zweckverband/i, category: "Müll" },
  
  // Versicherung
  { pattern: /versicherung/i, category: "Versicherung" },
  { pattern: /haftpflicht/i, category: "Versicherung" },
  { pattern: /gebäudeversicherung/i, category: "Versicherung" },
  { pattern: /allianz/i, category: "Versicherung" },
  { pattern: /axa/i, category: "Versicherung" },
  { pattern: /huk.?coburg/i, category: "Versicherung" },
  
  // Grundsteuer
  { pattern: /grundsteuer/i, category: "Grundsteuer" },
  { pattern: /gemeinde.*steuer/i, category: "Grundsteuer" },
  { pattern: /stadt.*steuer/i, category: "Grundsteuer" },
  
  // Hausmeister/Wartung
  { pattern: /hausmeister/i, category: "Hausmeister" },
  { pattern: /schornsteinfeger/i, category: "Wartung" },
  { pattern: /kaminkehrer/i, category: "Wartung" },
  { pattern: /heizungswartung/i, category: "Wartung" },
  { pattern: /wartung/i, category: "Wartung" },
  { pattern: /gartenpflege/i, category: "Wartung" },
  { pattern: /winterdienst/i, category: "Wartung" },
  { pattern: /treppenhausreinigung/i, category: "Wartung" },
  
  // Generische Stadtwerke
  { pattern: /stadtwerk/i, category: "Strom" },
];

function classifyWithRegex(zahlung: Zahlung): ClassificationResult | null {
  const text = `${zahlung.empfaengername || ""} ${zahlung.verwendungszweck || ""}`;
  
  // Check if should be excluded (Darlehen etc.)
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(text)) {
      return null; // Skip this payment entirely
    }
  }
  
  // Check for known Betriebskosten patterns
  for (const { pattern, category } of BETRIEBSKOSTEN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        zahlung_id: zahlung.id,
        is_betriebskosten: true,
        confidence: "high",
        category,
        suggested_immobilie_id: null,
        suggested_immobilie_name: null,
        reasoning: `Automatisch erkannt: ${category} (${zahlung.empfaengername || 'Unbekannt'})`,
        zahlung,
      };
    }
  }
  
  return undefined as any; // Needs AI classification
}

function tryMatchImmobilie(zahlung: Zahlung, immobilien: Immobilie[]): string | null {
  const text = `${zahlung.empfaengername || ""} ${zahlung.verwendungszweck || ""}`.toLowerCase();
  
  for (const imm of immobilien) {
    // Check if address parts are in the text
    const addressParts = imm.adresse.toLowerCase().split(/[\s,]+/).filter(p => p.length > 3);
    const nameParts = imm.name.toLowerCase().split(/[\s,]+/).filter(p => p.length > 3);
    
    for (const part of [...addressParts, ...nameParts]) {
      if (text.includes(part)) {
        return imm.id;
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all unassigned Nichtmiete payments
    const { data: zahlungen, error: zahlungenError } = await supabase
      .from("zahlungen")
      .select("*")
      .eq("kategorie", "Nichtmiete")
      .is("immobilie_id", null)
      .order("buchungsdatum", { ascending: false });

    if (zahlungenError) throw zahlungenError;

    // Fetch all Immobilien
    const { data: immobilien, error: immobilienError } = await supabase
      .from("immobilien")
      .select("id, name, adresse");

    if (immobilienError) throw immobilienError;

    if (!zahlungen || zahlungen.length === 0) {
      return new Response(
        JSON.stringify({ 
          classifications: [], 
          excluded: [],
          message: "Keine unzugeordneten Zahlungen gefunden",
          immobilien: immobilien || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const autoClassified: ClassificationResult[] = [];
    const needsAI: Zahlung[] = [];
    const excluded: Zahlung[] = [];

    // First pass: Regex classification
    for (const zahlung of zahlungen) {
      const result = classifyWithRegex(zahlung);
      
      if (result === null) {
        // Excluded (Darlehen etc.)
        excluded.push(zahlung);
      } else if (result) {
        // Auto-classified as Betriebskosten
        const suggestedImmobilie = tryMatchImmobilie(zahlung, immobilien || []);
        result.suggested_immobilie_id = suggestedImmobilie;
        result.suggested_immobilie_name = immobilien?.find(i => i.id === suggestedImmobilie)?.name || null;
        autoClassified.push(result);
      } else {
        // Needs AI classification
        needsAI.push(zahlung);
      }
    }

    console.log(`Auto-classified: ${autoClassified.length}, Needs AI: ${needsAI.length}, Excluded: ${excluded.length}`);

    // Only call AI if we have uncertain payments and not too many
    let aiClassified: ClassificationResult[] = [];
    
    if (needsAI.length > 0 && needsAI.length <= 30) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        const immobilienContext = (immobilien || [])
          .map((i: Immobilie) => `- ID: ${i.id}, Name: "${i.name}", Adresse: "${i.adresse}"`)
          .join("\n");

        const zahlungenContext = needsAI
          .map((z: Zahlung) => 
            `ID: ${z.id} | Betrag: ${z.betrag}€ | Empfänger: "${z.empfaengername || 'N/A'}" | Zweck: "${z.verwendungszweck || 'N/A'}"`
          )
          .join("\n");

        const systemPrompt = `Du klassifizierst Zahlungen für Immobilien-Betriebskosten.
Betriebskosten sind: Strom, Gas, Wasser, Abwasser, Müll, Versicherung, Grundsteuer, Hausmeister, Wartung.
KEINE Betriebskosten: Private Ausgaben, Miete, Gehälter, Investitionen.

Antworte nur mit der Funktion classify_payments.`;

        const userPrompt = `IMMOBILIEN:\n${immobilienContext}\n\nZAHLUNGEN:\n${zahlungenContext}`;

        try {
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
                    name: "classify_payments",
                    description: "Klassifiziere Zahlungen",
                    parameters: {
                      type: "object",
                      properties: {
                        classifications: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              zahlung_id: { type: "string" },
                              is_betriebskosten: { type: "boolean" },
                              confidence: { type: "string", enum: ["high", "medium", "low"] },
                              category: { type: "string" },
                              suggested_immobilie_id: { type: "string", nullable: true },
                              reasoning: { type: "string" },
                            },
                            required: ["zahlung_id", "is_betriebskosten", "confidence", "category", "reasoning"],
                          },
                        },
                      },
                      required: ["classifications"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "classify_payments" } },
            }),
          });

          if (response.ok) {
            const aiResult = await response.json();
            const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.name === "classify_payments") {
              const parsedArgs = JSON.parse(toolCall.function.arguments);
              const aiResults = parsedArgs.classifications || [];
              
              const zahlungenMap = new Map(needsAI.map(z => [z.id, z]));
              aiClassified = aiResults.map((c: any) => ({
                ...c,
                suggested_immobilie_name: immobilien?.find(i => i.id === c.suggested_immobilie_id)?.name || null,
                zahlung: zahlungenMap.get(c.zahlung_id),
              }));
            }
          } else {
            console.error("AI response not ok:", response.status);
          }
        } catch (aiError) {
          console.error("AI classification error:", aiError);
        }
      }
    } else if (needsAI.length > 30) {
      // Too many for AI - classify as low confidence
      aiClassified = needsAI.slice(0, 50).map(z => ({
        zahlung_id: z.id,
        is_betriebskosten: true,
        confidence: "low" as const,
        category: "Sonstige",
        suggested_immobilie_id: tryMatchImmobilie(z, immobilien || []),
        suggested_immobilie_name: null,
        reasoning: "Manuell prüfen - automatische Klassifizierung nicht möglich",
        zahlung: z,
      }));
    }

    // Combine all results
    const allClassifications = [...autoClassified, ...aiClassified];

    return new Response(
      JSON.stringify({
        classifications: allClassifications,
        excluded_count: excluded.length,
        auto_classified: autoClassified.length,
        ai_classified: aiClassified.length,
        total_unassigned: zahlungen.length,
        immobilien: immobilien || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("classify-nebenkosten error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
