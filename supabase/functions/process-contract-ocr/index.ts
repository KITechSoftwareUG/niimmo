import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContractData {
  kaltmiete?: number;
  betriebskosten?: number;
  kaution_betrag?: number;
  start_datum?: string;
  ende_datum?: string;
  mieter_vorname?: string;
  mieter_nachname?: string;
  verwendungszweck?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, fileType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing document: ${fileName} (${fileType})`);

    // Prepare the prompt for contract data extraction
    const systemPrompt = `Du bist ein Experte für die Extraktion von Mietvertragsdaten aus deutschen Dokumenten. 
    Analysiere das bereitgestellte Dokument und extrahiere folgende Informationen:
    
    - Kaltmiete (nur der Betrag in Euro, ohne Währungszeichen)
    - Betriebskosten/Nebenkosten (nur der Betrag in Euro)
    - Kaution/Sicherheitsleistung (nur der Betrag in Euro)
    - Mietbeginn/Startdatum (Format: YYYY-MM-DD)
    - Mietende/Enddatum falls befristet (Format: YYYY-MM-DD oder null)
    - Mieter Vorname
    - Mieter Nachname (falls mehrere Mieter, nimm den ersten Hauptmieter)
    - Verwendungszweck für Mietzahlungen falls angegeben
    
    Antworte NUR mit einem JSON-Objekt ohne zusätzliche Erklärungen.
    Bei fehlenden Daten verwende null.
    
    Beispiel-Antwort:
    {
      "kaltmiete": 850.00,
      "betriebskosten": 120.50,
      "kaution_betrag": 2550.00,
      "start_datum": "2024-01-15",
      "ende_datum": null,
      "mieter_vorname": "Max",
      "mieter_nachname": "Mustermann",
      "verwendungszweck": "Miete Wohnung 12 - Musterstraße 123"
    }`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Bitte analysiere dieses Mietvertragsdokument und extrahiere die relevanten Daten:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileType};base64,${fileContent}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI processing failed: ${response.statusText}`);
    }

    const aiResult = await response.json();
    const extractedText = aiResult.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("No content extracted from AI response");
    }

    console.log("AI extracted text:", extractedText);

    // Parse the JSON response
    let extractedData: ContractData;
    try {
      // Remove any markdown formatting if present
      const cleanedText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", extractedText);
      throw new Error("Could not parse extracted data as JSON");
    }

    // Validate and clean the extracted data
    const validatedData: ContractData = {};
    
    if (extractedData.kaltmiete && typeof extractedData.kaltmiete === 'number' && extractedData.kaltmiete > 0) {
      validatedData.kaltmiete = extractedData.kaltmiete;
    }
    
    if (extractedData.betriebskosten && typeof extractedData.betriebskosten === 'number' && extractedData.betriebskosten > 0) {
      validatedData.betriebskosten = extractedData.betriebskosten;
    }
    
    if (extractedData.kaution_betrag && typeof extractedData.kaution_betrag === 'number' && extractedData.kaution_betrag > 0) {
      validatedData.kaution_betrag = extractedData.kaution_betrag;
    }
    
    if (extractedData.start_datum && typeof extractedData.start_datum === 'string') {
      // Validate date format
      if (/^\d{4}-\d{2}-\d{2}$/.test(extractedData.start_datum)) {
        validatedData.start_datum = extractedData.start_datum;
      }
    }
    
    if (extractedData.ende_datum && typeof extractedData.ende_datum === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(extractedData.ende_datum)) {
        validatedData.ende_datum = extractedData.ende_datum;
      }
    }
    
    if (extractedData.mieter_vorname && typeof extractedData.mieter_vorname === 'string') {
      validatedData.mieter_vorname = extractedData.mieter_vorname.trim();
    }
    
    if (extractedData.mieter_nachname && typeof extractedData.mieter_nachname === 'string') {
      validatedData.mieter_nachname = extractedData.mieter_nachname.trim();
    }
    
    if (extractedData.verwendungszweck && typeof extractedData.verwendungszweck === 'string') {
      validatedData.verwendungszweck = extractedData.verwendungszweck.trim();
    }

    console.log("Validated extracted data:", validatedData);

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: validatedData,
        confidence: Object.keys(validatedData).length > 0 ? 'high' : 'low',
        fieldsExtracted: Object.keys(validatedData).length
      }),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );

  } catch (error: any) {
    console.error("OCR processing error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "OCR processing failed",
        extractedData: {}
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );
  }
});