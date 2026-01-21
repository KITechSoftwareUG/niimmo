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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { year } = await req.json();
    const selectedYear = year || 2025;

    // Fetch all Nichtmiete payments for the year
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data: zahlungen, error: zahlungenError } = await supabase
      .from("zahlungen")
      .select("*")
      .eq("kategorie", "Nichtmiete")
      .gte("buchungsdatum", yearStart)
      .lte("buchungsdatum", yearEnd)
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
        JSON.stringify({ classifications: [], message: "Keine unzugeordneten Zahlungen gefunden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare context for AI
    const immobilienContext = (immobilien || [])
      .map((i: Immobilie) => `- ID: ${i.id}, Name: "${i.name}", Adresse: "${i.adresse}"`)
      .join("\n");

    const zahlungenBatch = zahlungen.slice(0, 50); // Process in batches of 50

    const zahlungenContext = zahlungenBatch
      .map((z: Zahlung) => 
        `ID: ${z.id} | Betrag: ${z.betrag}€ | Datum: ${z.buchungsdatum} | Empfänger: "${z.empfaengername || 'N/A'}" | Verwendungszweck: "${z.verwendungszweck || 'N/A'}"`
      )
      .join("\n");

    const systemPrompt = `Du bist ein Experte für Immobilienverwaltung und Betriebskostenabrechnung in Deutschland.

Deine Aufgabe ist es, Zahlungen zu analysieren und zu klassifizieren:
1. Ist die Zahlung eine Betriebskosten-relevante Zahlung (Strom, Gas, Wasser, Versicherung, Müllabfuhr, Grundsteuer, Hausmeister, etc.)?
2. Welche Kategorie hat die Zahlung?
3. Zu welcher Immobilie gehört die Zahlung wahrscheinlich (basierend auf Adresse im Verwendungszweck oder Empfänger)?

WICHTIG:
- "high" confidence: Eindeutige Betriebskosten (Stadtwerke, Wasserwerk, Versicherung, Müllabfuhr)
- "medium" confidence: Wahrscheinlich Betriebskosten aber nicht 100% sicher
- "low" confidence: Unklar, könnte Betriebskosten sein

Kategorien: Strom, Gas, Wasser, Abwasser, Müll, Versicherung, Grundsteuer, Hausmeister, Wartung, Sonstige`;

    const userPrompt = `Analysiere diese Zahlungen und ordne sie den Immobilien zu.

IMMOBILIEN:
${immobilienContext}

ZAHLUNGEN:
${zahlungenContext}

Antworte für JEDE Zahlung mit der Funktion classify_payments.`;

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
              description: "Klassifiziere alle Zahlungen",
              parameters: {
                type: "object",
                properties: {
                  classifications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        zahlung_id: { type: "string", description: "ID der Zahlung" },
                        is_betriebskosten: { type: "boolean", description: "Ist es eine Betriebskostenrelevante Zahlung?" },
                        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Konfidenz der Klassifizierung" },
                        category: { type: "string", description: "Kategorie: Strom, Gas, Wasser, Abwasser, Müll, Versicherung, Grundsteuer, Hausmeister, Wartung, Sonstige" },
                        suggested_immobilie_id: { type: "string", nullable: true, description: "ID der vorgeschlagenen Immobilie oder null" },
                        reasoning: { type: "string", description: "Kurze Begründung der Klassifizierung" },
                      },
                      required: ["zahlung_id", "is_betriebskosten", "confidence", "category", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["classifications"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_payments" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "classify_payments") {
      throw new Error("Invalid AI response format");
    }

    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const classifications: ClassificationResult[] = parsedArgs.classifications || [];

    // Enrich with immobilie names
    const enrichedClassifications = classifications.map((c: ClassificationResult) => {
      const immobilie = immobilien?.find((i: Immobilie) => i.id === c.suggested_immobilie_id);
      return {
        ...c,
        suggested_immobilie_name: immobilie?.name || null,
      };
    });

    // Also return the original zahlungen data for the UI
    const zahlungenMap = new Map(zahlungenBatch.map((z: Zahlung) => [z.id, z]));
    const results = enrichedClassifications.map((c: ClassificationResult) => ({
      ...c,
      zahlung: zahlungenMap.get(c.zahlung_id),
    }));

    return new Response(
      JSON.stringify({
        classifications: results,
        total_unassigned: zahlungen.length,
        processed: zahlungenBatch.length,
        immobilien: immobilien,
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
