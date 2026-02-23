import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  'https://immobilien-blick-dashboard.lovable.app',
  'https://id-preview--8e9e2f9b-7950-413f-adfd-90b0d2663ae1.lovable.app',
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

  if (req.method === "OPTIONS") {
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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials are not configured");
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching database context...");

    // Fetch database context
    const [
      immobilienResult,
      mietvertraegeResult,
      mieterResult,
      zahlungenResult,
      forderungenResult,
      einheitenResult
    ] = await Promise.all([
      supabase.from("immobilien").select("id, name, adresse, einheiten_anzahl, objekttyp"),
      supabase.from("mietvertrag").select(`
        id, 
        kaltmiete, 
        betriebskosten, 
        status, 
        start_datum, 
        ende_datum,
        kuendigungsdatum,
        mahnstufe,
        kaution_betrag,
        kaution_ist,
        einheit_id
      `),
      supabase.from("mieter").select("id, vorname, nachname, hauptmail, telnr"),
      supabase.from("zahlungen")
        .select("id, betrag, buchungsdatum, kategorie, mietvertrag_id, zugeordneter_monat")
        .order("buchungsdatum", { ascending: false })
        .limit(100),
      supabase.from("mietforderungen")
        .select("id, sollbetrag, sollmonat, ist_faellig, mietvertrag_id")
        .eq("ist_faellig", true),
      supabase.from("einheiten").select("id, immobilie_id, qm, etage, einheitentyp")
    ]);

    // Fetch mietvertrag_mieter relations
    const mietvertragMieterResult = await supabase
      .from("mietvertrag_mieter")
      .select("mietvertrag_id, mieter_id");

    // Build context
    const immobilien = immobilienResult.data || [];
    const mietvertraege = mietvertraegeResult.data || [];
    const mieter = mieterResult.data || [];
    const zahlungen = zahlungenResult.data || [];
    const forderungen = forderungenResult.data || [];
    const einheiten = einheitenResult.data || [];
    const mietvertragMieter = mietvertragMieterResult.data || [];

    console.log(`Loaded: ${immobilien.length} Immobilien, ${mietvertraege.length} Mietverträge, ${mieter.length} Mieter`);

    // Calculate statistics
    const aktiveMietvertraege = mietvertraege.filter(v => v.status === "aktiv");
    const gekuendigteMietvertraege = mietvertraege.filter(v => v.status === "gekuendigt");
    const beendeteMietvertraege = mietvertraege.filter(v => v.status === "beendet");
    
    const gesamtKaltmiete = aktiveMietvertraege.reduce((sum, v) => sum + (v.kaltmiete || 0), 0);
    const gesamtBetriebskosten = aktiveMietvertraege.reduce((sum, v) => sum + (v.betriebskosten || 0), 0);
    
    const offeneForderungen = forderungen.filter(f => f.ist_faellig);
    const gesamtRueckstand = offeneForderungen.reduce((sum, f) => sum + (f.sollbetrag || 0), 0);
    
    const vertraegeInMahnung = mietvertraege.filter(v => (v.mahnstufe || 0) > 0);

    // Build detailed immobilien info
    const immobilienDetails = immobilien.map(immo => {
      const immoEinheiten = einheiten.filter(e => e.immobilie_id === immo.id);
      const immoVertraege = mietvertraege.filter(v => {
        const einheit = immoEinheiten.find(e => e.id === v.einheit_id);
        return einheit !== undefined;
      });
      const aktiveVertraege = immoVertraege.filter(v => v.status === "aktiv" || v.status === "gekuendigt");
      const immoKaltmiete = aktiveVertraege.reduce((sum, v) => sum + (v.kaltmiete || 0), 0);
      
      return `- ${immo.name} (${immo.adresse}): ${immo.einheiten_anzahl} Einheiten, ${aktiveVertraege.length} aktive Verträge, ${immoKaltmiete.toFixed(2)}€ Kaltmiete/Monat`;
    }).join("\n");

    // Build mieter with contracts info
    const mieterDetails = mieter.slice(0, 30).map(m => {
      const mieterVertraege = mietvertragMieter
        .filter(mv => mv.mieter_id === m.id)
        .map(mv => mietvertraege.find(v => v.id === mv.mietvertrag_id))
        .filter(v => v !== undefined);
      
      const aktiverVertrag = mieterVertraege.find(v => v?.status === "aktiv");
      const status = aktiverVertrag ? "aktiv" : "kein aktiver Vertrag";
      
      return `- ${m.vorname} ${m.nachname || ""}: ${status}${aktiverVertrag ? `, ${aktiverVertrag.kaltmiete}€ Kaltmiete` : ""}`;
    }).join("\n");

    // Build Rückstände info
    const rueckstandDetails = vertraegeInMahnung.slice(0, 20).map(v => {
      const einheit = einheiten.find(e => e.id === v.einheit_id);
      const immo = einheit ? immobilien.find(i => i.id === einheit.immobilie_id) : null;
      const vertragMieter = mietvertragMieter.filter(mv => mv.mietvertrag_id === v.id);
      const mieterNamen = vertragMieter
        .map(vm => mieter.find(m => m.id === vm.mieter_id))
        .filter(m => m)
        .map(m => `${m?.vorname} ${m?.nachname || ""}`)
        .join(", ");
      
      return `- Mahnstufe ${v.mahnstufe}: ${mieterNamen || "Unbekannt"} (${immo?.name || "Unbekannt"})`;
    }).join("\n");

    // Recent payments
    const recentPayments = zahlungen.slice(0, 10).map(z => {
      return `- ${z.buchungsdatum}: ${z.betrag.toFixed(2)}€ (${z.kategorie || "Nicht zugeordnet"})`;
    }).join("\n");

    const databaseContext = `
=== AKTUELLE DATENBANK-ÜBERSICHT ===

STATISTIKEN:
- Anzahl Immobilien: ${immobilien.length}
- Anzahl Einheiten gesamt: ${einheiten.length}
- Aktive Mietverträge: ${aktiveMietvertraege.length}
- Gekündigte Mietverträge: ${gekuendigteMietvertraege.length}
- Beendete Mietverträge: ${beendeteMietvertraege.length}
- Anzahl Mieter: ${mieter.length}
- Gesamte monatliche Kaltmiete: ${gesamtKaltmiete.toFixed(2)}€
- Gesamte monatliche Betriebskosten: ${gesamtBetriebskosten.toFixed(2)}€
- Gesamte monatliche Warmmiete: ${(gesamtKaltmiete + gesamtBetriebskosten).toFixed(2)}€
- Offene Forderungen (fällig): ${offeneForderungen.length}
- Geschätzter Gesamtrückstand: ${gesamtRueckstand.toFixed(2)}€
- Verträge in Mahnung: ${vertraegeInMahnung.length}

IMMOBILIEN:
${immobilienDetails || "Keine Immobilien vorhanden"}

MIETER (Auszug):
${mieterDetails || "Keine Mieter vorhanden"}

RÜCKSTÄNDE/MAHNUNGEN:
${rueckstandDetails || "Keine Rückstände vorhanden"}

LETZTE ZAHLUNGEN:
${recentPayments || "Keine Zahlungen vorhanden"}
`;

    const systemPrompt = `Du bist Chilla, ein freundlicher und kompetenter KI-Assistent für die Immobilienverwaltung bei NiImmo. 

Du hast Zugriff auf die aktuelle Datenbank und kannst konkrete Fragen zu Immobilien, Mietern, Zahlungen und Verträgen beantworten.

${databaseContext}

Deine Aufgaben:
- Beantworte Fragen zur Immobilienverwaltung basierend auf den echten Daten
- Gib Auskunft über Immobilien, Mieter, Mietverträge und Zahlungen
- Hilf bei der Analyse von Rückständen und Mahnungen
- Erkläre Funktionen des NiImmo Dashboards

Wichtige Regeln:
- Antworte immer auf Deutsch
- Nutze die Daten aus der Datenbank für konkrete Antworten
- Sei freundlich, professionell und hilfsbereit
- Halte deine Antworten prägnant aber informativ
- Bei rechtlichen Fragen weise darauf hin, dass professionelle Rechtsberatung eingeholt werden sollte
- Du kannst keine direkten Änderungen an der Datenbank vornehmen, aber du kannst die aktuellen Daten lesen und analysieren`;

    console.log("Sending request to Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen, bitte versuche es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Zahlungsfehler, bitte kontaktiere den Support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI Gateway Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response...");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
