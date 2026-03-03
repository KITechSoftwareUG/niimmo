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
    const { textContent } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length < 20) {
      throw new Error("Bitte fügen Sie den Tilgungsplan-Text ein (mindestens 20 Zeichen).");
    }

    console.log(`Processing Tilgungsplan text (${textContent.length} chars)`);

    const systemPrompt = `Du bist ein Experte für die Extraktion von Darlehens- und Tilgungsplandaten aus Volksbank-Dokumenten.

WICHTIG — VOLKSBANK-FORMAT:
Die Dokumente haben immer dasselbe Format. Die wichtigsten Daten stehen im KOPFBEREICH des Dokuments:
- Kontoinhaber (= bezeichnung)
- IBAN (= kontonummer)
- BIC
- Zinsbindungsende (= ende_datum)
- Ursprungsdarlehen (= darlehensbetrag)
- Aktueller Kontostand (= restschuld) — ACHTUNG: Steht oft als negativer Betrag, z.B. "-290.933,56 EUR". Den ABSOLUTEN WERT als restschuld verwenden!
- Restschuld zum Zinsbindungsende (= restschuld_zinsbindungsende) — ebenfalls als positiven Wert

VORZEICHEN-REGEL: Alle Beträge IMMER als POSITIVE Zahlen zurückgeben. Negative Vorzeichen im Dokument ignorieren und den Absolutwert nehmen.

Danach folgt der Tilgungsplan als Tabelle mit Spalten:
- Zeitraum (Format MM.YYYY) → als buchungsdatum im Format YYYY-MM-01 zurückgeben
- Zahlung (= betrag, Gesamtrate)
- Tilgung (= tilgungsanteil)
- Sollzinsen (= zinsanteil)
- Restschuld (= restschuld_danach)

Extrahiere folgende Felder:

1. Darlehens-Stammdaten:
- bezeichnung: Kontoinhaber oder Name des Darlehens
- bank: "Volksbank" (oder aus dem Dokument, falls anders)
- kontonummer: IBAN
- darlehensbetrag: Ursprungsdarlehen in Euro (positiv!)
- restschuld: Absoluter Wert von "Aktueller Kontostand" (positiv!)
- zinssatz_prozent: Zinssatz in Prozent
- tilgungssatz_prozent: Tilgungssatz falls angegeben, sonst null
- monatliche_rate: Monatliche Rate in Euro (aus der ersten Zahlung im Plan oder den Kopfdaten)
- start_datum: Erstes Datum im Tilgungsplan (Format YYYY-MM-DD)
- ende_datum: Zinsbindungsende (Format YYYY-MM-DD)
- restschuld_zinsbindungsende: Restschuld zum Zinsbindungsende (positiv!) — separates Feld
- notizen: Weitere relevante Infos (BIC, Sondertilgungsrechte etc.)

2. Tilgungsplan-Zahlungen (Array "zahlungen"):
Extrahiere ALLE Zeilen des Tilgungsplans:
- buchungsdatum: Zeitraum MM.YYYY → Format YYYY-MM-01
- betrag: Zahlung (Gesamtrate, positiv)
- zinsanteil: Sollzinsen (positiv)
- tilgungsanteil: Tilgung (positiv)
- restschuld_danach: Restschuld nach dieser Zahlung (positiv)

DEUTSCHE ZAHLENFORMATE: 1.250,00 = 1250.00 / 290.933,56 = 290933.56

Antworte NUR mit einem JSON-Objekt. Kein zusätzlicher Text, keine Erklärungen.

Beispiel-Antwort:
{
  "bezeichnung": "Max Mustermann",
  "bank": "Volksbank",
  "kontonummer": "DE49 2559 1413 3155 4105 42",
  "darlehensbetrag": 300000.00,
  "restschuld": 290933.56,
  "zinssatz_prozent": 0.76,
  "tilgungssatz_prozent": null,
  "monatliche_rate": 3630.33,
  "start_datum": "2021-10-01",
  "ende_datum": "2031-09-30",
  "restschuld_zinsbindungsende": 210000.00,
  "notizen": "BIC: GENODEF1NIE",
  "zahlungen": [
    {
      "buchungsdatum": "2021-10-01",
      "betrag": 3630.33,
      "zinsanteil": 706.80,
      "tilgungsanteil": 2923.53,
      "restschuld_danach": 297076.47
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Bitte analysiere diesen kopierten Volksbank-Tilgungsplan und extrahiere alle Daten. Achte besonders auf den "Aktueller Kontostand" im Kopfbereich — das ist die Restschuld!\n\n${textContent}` }
        ],
        max_tokens: 32000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate-Limit erreicht. Bitte versuchen Sie es in einer Minute erneut." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI-Guthaben aufgebraucht. Bitte laden Sie Ihr Guthaben auf." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI-Verarbeitung fehlgeschlagen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const aiResult = await response.json();
    const extractedText = aiResult.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("Keine Daten aus der KI-Antwort extrahiert");
    }

    console.log("AI extracted text length:", extractedText.length);

    const cleanedText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
    const extractedData = JSON.parse(cleanedText);

    // Post-processing: ensure all numeric values are positive (absolute values)
    const absNum = (v: any) => (typeof v === 'number' ? Math.abs(v) : v);
    extractedData.darlehensbetrag = absNum(extractedData.darlehensbetrag);
    extractedData.restschuld = absNum(extractedData.restschuld);
    extractedData.monatliche_rate = absNum(extractedData.monatliche_rate);
    extractedData.zinssatz_prozent = absNum(extractedData.zinssatz_prozent);
    extractedData.tilgungssatz_prozent = absNum(extractedData.tilgungssatz_prozent);
    extractedData.restschuld_zinsbindungsende = absNum(extractedData.restschuld_zinsbindungsende);

    if (Array.isArray(extractedData.zahlungen)) {
      extractedData.zahlungen = extractedData.zahlungen.map((z: any) => ({
        ...z,
        betrag: absNum(z.betrag),
        zinsanteil: absNum(z.zinsanteil),
        tilgungsanteil: absNum(z.tilgungsanteil),
        restschuld_danach: absNum(z.restschuld_danach),
      }));
    }

    console.log("Extracted loan:", extractedData.bezeichnung, "restschuld:", extractedData.restschuld, "with", extractedData.zahlungen?.length || 0, "payments");

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