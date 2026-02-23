import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  'https://immobilien-blick-dashboard.lovable.app',
  'https://id-preview--8e9e2f9b-7950-413f-adfd-90b0d2663ae1.lovable.app',
  'https://dashboard.niimmo.de',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { error: authError } = await authClient.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { fileContent, fileName, fileType, textContent } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing Tilgungsplan: ${fileName} (${fileType})`);

    const systemPrompt = `Du bist ein Experte für die Extraktion von Darlehens- und Tilgungsplandaten aus deutschen Bankdokumenten.
Analysiere das bereitgestellte Dokument und extrahiere folgende Informationen:

1. Darlehens-Stammdaten:
- bezeichnung: Name/Bezeichnung des Darlehens (z.B. "KFW Darlehen Langenhagen")
- bank: Name der Bank
- kontonummer: IBAN oder Kontonummer des Darlehens
- darlehensbetrag: Ursprünglicher Darlehensbetrag in Euro (Zahl)
- restschuld: Aktuelle Restschuld in Euro (Zahl, die letzte im Plan genannte)
- zinssatz_prozent: Zinssatz in Prozent (Zahl)
- tilgungssatz_prozent: Tilgungssatz in Prozent falls angegeben (Zahl oder null)
- monatliche_rate: Monatliche Rate/Annuität in Euro (Zahl)
- start_datum: Startdatum des Darlehens (Format: YYYY-MM-DD)
- ende_datum: Enddatum/Zinsbindungsende (Format: YYYY-MM-DD oder null)
- notizen: Wichtige Zusatzinfos wie Zinsbindungsende, Sondertilgungsrechte etc.

2. Tilgungsplan-Zahlungen (Array):
Extrahiere ALLE Zeilen des Tilgungsplans als Array "zahlungen" mit:
- buchungsdatum: Datum der Zahlung (Format: YYYY-MM-DD)
- betrag: Gesamtbetrag der Rate in Euro (Zahl, positiv)
- zinsanteil: Zinsanteil in Euro (Zahl)
- tilgungsanteil: Tilgungsanteil in Euro (Zahl)
- restschuld_danach: Restschuld nach dieser Zahlung in Euro (Zahl)

Antworte NUR mit einem JSON-Objekt. Bei fehlenden Daten verwende null.

Beispiel:
{
  "bezeichnung": "KFW Darlehen",
  "bank": "Volksbank",
  "kontonummer": "DE49 2559 1413 3155 4105 42",
  "darlehensbetrag": 1116000.00,
  "restschuld": 645618.49,
  "zinssatz_prozent": 0.76,
  "tilgungssatz_prozent": 3.15,
  "monatliche_rate": 3630.33,
  "start_datum": "2021-10-01",
  "ende_datum": "2031-09-30",
  "notizen": "Zinsbindung bis 30.09.2031, Restschuld bei Zinsbindungsende: 421.847,59 EUR",
  "zahlungen": [
    {
      "buchungsdatum": "2021-10-30",
      "betrag": 3630.33,
      "zinsanteil": 706.80,
      "tilgungsanteil": 2923.53,
      "restschuld_danach": 1113076.47
    }
  ]
}`;

    let userMessage: any;
    if (textContent && typeof textContent === 'string' && textContent.trim().length > 0) {
      userMessage = {
        role: "user",
        content: `Bitte analysiere diesen Tilgungsplan und extrahiere alle Daten:\n\n${textContent}`
      };
    } else if (fileContent) {
      // Determine the correct MIME type for the image_url
      const mimeType = fileType === 'application/pdf' ? 'application/pdf' : (fileType || 'image/png');
      userMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: "Bitte analysiere diesen Tilgungsplan und extrahiere alle Daten:"
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${fileContent}`
            }
          }
        ]
      };
    } else {
      throw new Error("Weder Text noch Dateiinhalt vorhanden");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          userMessage
        ],
        max_tokens: 16000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "AI-Verarbeitung fehlgeschlagen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const aiResult = await response.json();
    const extractedText = aiResult.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("No content extracted from AI response");
    }

    console.log("AI extracted text length:", extractedText.length);

    const cleanedText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
    const extractedData = JSON.parse(cleanedText);

    console.log("Extracted loan:", extractedData.bezeichnung, "with", extractedData.zahlungen?.length || 0, "payments");

    return new Response(
      JSON.stringify({
        success: true,
        extractedData,
        zahlungenCount: extractedData.zahlungen?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Tilgungsplan processing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Verarbeitung fehlgeschlagen" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
