import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, fileType, textContent } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing document: ${fileName} (${fileType})`);

    const systemPrompt = `Du bist ein Experte für die Extraktion von Mietvertragsdaten aus deutschen Dokumenten. 
Analysiere das bereitgestellte Dokument und extrahiere folgende Informationen:

- Alle Mieter mit Vorname, Nachname, E-Mail, Telefonnummer, Geburtsdatum und Rolle (hauptmieter oder mitmieter)
- Kaltmiete (nur der Betrag in Euro, als Zahl)
- Betriebskosten/Nebenkosten (nur der Betrag in Euro, als Zahl)
- Kaution/Sicherheitsleistung (nur der Betrag in Euro, als Zahl)
- Mietbeginn/Startdatum (Format: YYYY-MM-DD)
- Mietende/Enddatum falls befristet (Format: YYYY-MM-DD oder null)
- Ob Lastschrift vereinbart ist (true/false)
- IBAN/Bankkonto des Mieters
- Rücklastschrift-Gebühr falls angegeben
- Verwendungszweck für Mietzahlungen
- Zählerstände bei Einzug: Strom, Gas, Kaltwasser, Warmwasser

Antworte NUR mit einem JSON-Objekt ohne zusätzliche Erklärungen.
Bei fehlenden Daten verwende null.

Beispiel-Antwort:
{
  "mieter": [
    {
      "vorname": "Max",
      "nachname": "Mustermann",
      "hauptmail": "max@example.de",
      "telnr": "+49 123 456789",
      "geburtsdatum": "1990-01-15",
      "rolle": "hauptmieter"
    }
  ],
  "kaltmiete": 850.00,
  "betriebskosten": 120.50,
  "kaution_betrag": 2550.00,
  "start_datum": "2024-01-15",
  "ende_datum": null,
  "lastschrift": true,
  "bankkonto_mieter": "DE89 3704 0044 0532 0130 00",
  "ruecklastschrift_gebuehr": 7.50,
  "verwendungszweck": "Miete Wohnung 12",
  "strom_einzug": 12345,
  "gas_einzug": 23456,
  "kaltwasser_einzug": 34567,
  "warmwasser_einzug": 45678
}`;

    let userMessage: any;
    
    if (textContent && typeof textContent === 'string' && textContent.trim().length > 10) {
      // Text-based processing
      console.log(`Using text mode, text length: ${textContent.trim().length}`);
      userMessage = {
        role: "user",
        content: `Bitte analysiere dieses Mietvertragsdokument (Textauszug):\n\n${textContent}`
      };
    } else if (fileContent && typeof fileContent === 'string' && fileContent.length > 100) {
      // Image-based processing (JPG, PNG, rendered PDF pages)
      // Validate base64 starts with JPEG magic bytes
      const isValidJpeg = fileContent.startsWith('/9j/');
      const isValidPng = fileContent.startsWith('iVBOR');
      console.log(`Using image mode, base64 length: ${fileContent.length}, valid JPEG: ${isValidJpeg}, valid PNG: ${isValidPng}`);
      
      if (!isValidJpeg && !isValidPng) {
        console.error('Invalid image data: does not start with known image magic bytes. First 20 chars:', fileContent.substring(0, 20));
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültiges Bildformat. Bitte lade ein klares JPG oder PNG hoch.' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      
      userMessage = {
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
      };
    } else {
      console.error('No usable content received. textContent length:', textContent?.length, 'fileContent length:', fileContent?.length);
      return new Response(
        JSON.stringify({ success: false, error: 'Kein verwertbarer Inhalt im Dokument gefunden. Bitte lade ein textbasiertes PDF oder ein klares Bild hoch.' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
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
          userMessage,
        ],
        max_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate-Limit erreicht. Bitte versuche es in einer Minute erneut." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI-Credits aufgebraucht. Bitte Credits aufladen." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      let friendly = "AI-Verarbeitung fehlgeschlagen.";
      try {
        if (response.status === 400) {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message?.includes("Failed to extract")) {
            friendly = "Das hochgeladene PDF konnte nicht als Bild gelesen werden. Bitte lade ein klares JPG/PNG hoch oder ein textbasiertes PDF.";
          }
        }
      } catch (_) { /* ignore */ }

      return new Response(
        JSON.stringify({ success: false, error: friendly, extractedData: {}, fieldsExtracted: 0, confidence: 'low' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const aiResult = await response.json();
    const extractedText = aiResult.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("No content extracted from AI response");
    }

    console.log("AI extracted text:", extractedText);

    // Parse JSON
    let extractedData: any;
    try {
      const cleanedText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", extractedText);
      throw new Error("Could not parse extracted data as JSON");
    }

    // Count extracted fields
    let fieldsExtracted = 0;
    const validatedData: any = {};

    // Mieter array
    if (Array.isArray(extractedData.mieter) && extractedData.mieter.length > 0) {
      validatedData.mieter = extractedData.mieter.map((m: any) => ({
        vorname: m.vorname || '',
        nachname: m.nachname || '',
        hauptmail: m.hauptmail || '',
        telnr: m.telnr || '',
        geburtsdatum: m.geburtsdatum || '',
        rolle: m.rolle === 'mitmieter' ? 'mitmieter' : 'hauptmieter',
      }));
      fieldsExtracted += validatedData.mieter.length;
    }

    // Numeric fields
    for (const key of ['kaltmiete', 'betriebskosten', 'kaution_betrag', 'ruecklastschrift_gebuehr', 'strom_einzug', 'gas_einzug', 'kaltwasser_einzug', 'warmwasser_einzug']) {
      if (extractedData[key] != null && !isNaN(Number(extractedData[key]))) {
        validatedData[key] = Number(extractedData[key]);
        fieldsExtracted++;
      }
    }

    // Date fields
    for (const key of ['start_datum', 'ende_datum']) {
      if (extractedData[key] && typeof extractedData[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extractedData[key])) {
        validatedData[key] = extractedData[key];
        fieldsExtracted++;
      }
    }

    // String fields
    for (const key of ['verwendungszweck', 'bankkonto_mieter']) {
      if (extractedData[key] && typeof extractedData[key] === 'string') {
        validatedData[key] = extractedData[key].trim();
        fieldsExtracted++;
      }
    }

    // Boolean fields
    if (typeof extractedData.lastschrift === 'boolean') {
      validatedData.lastschrift = extractedData.lastschrift;
      fieldsExtracted++;
    }

    console.log("Validated extracted data:", validatedData, "Fields:", fieldsExtracted);

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: validatedData,
        confidence: fieldsExtracted >= 5 ? 'high' : fieldsExtracted >= 2 ? 'medium' : 'low',
        fieldsExtracted
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("OCR processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "OCR processing failed",
        extractedData: {}
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
