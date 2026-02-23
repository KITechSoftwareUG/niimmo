import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

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

interface MahnungRequest {
  mietvertragId: string;
  mahnstufe: number;
  vertragData: any;
  forderungen: any[];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { mietvertragId, mahnstufe, vertragData, forderungen }: MahnungRequest = await req.json()

    console.log('Mahnung wird versendet:', { mietvertragId, mahnstufe, forderungenCount: forderungen?.length })

    // Hole Mieter-Daten
    const { data: mieterData, error: mieterError } = await supabase
      .from('mietvertrag_mieter')
      .select(`
        mieter:mieter_id (
          vorname,
          nachname,
          hauptmail,
          weitere_mails
        )
      `)
      .eq('mietvertrag_id', mietvertragId);

    if (mieterError) {
      console.error('Fehler beim Laden der Mieter-Daten:', mieterError)
      throw mieterError
    }

    if (!mieterData || mieterData.length === 0) {
      throw new Error('Keine Mieter-Daten gefunden')
    }

    // Hole den ersten Mieter
    const mieterRecord = mieterData[0];
    if (!mieterRecord?.mieter) {
      throw new Error('Mieter-Informationen nicht vollständig')
    }
    const mieter = mieterRecord.mieter as any;

    // Berechne Gesamtbetrag der offenen Forderungen
    const gesamtbetrag = forderungen.reduce((sum, f) => sum + parseFloat(f.sollbetrag), 0);
    
    // Erstelle Mahnung-Nachricht
    const mahnungstext = generateMahnungstext(mahnstufe, mieter, vertragData, forderungen, gesamtbetrag);

    // Log die Mahnung in system_logs
    await supabase
      .from('system_logs')
      .insert({
        message: `Mahnung Stufe ${mahnstufe} für Mietvertrag ${mietvertragId} erstellt. Empfänger: ${mieter.vorname} ${mieter.nachname} (${mieter.hauptmail}). Gesamtbetrag: ${gesamtbetrag.toFixed(2)}€`
      });

    // Hier würde normalerweise der E-Mail-Versand stattfinden
    // Für jetzt simulieren wir den Versand
    console.log('Mahnung würde versendet an:', mieter.hauptmail);
    console.log('Mahnungstext:', mahnungstext);

    // Erhöhe die Mahnstufe und aktualisiere den Mietvertrag
    const neueMahnstufe = Math.min(mahnstufe + 1, 3); // Maximal Stufe 3
    await supabase
      .from('mietvertrag')
      .update({
        mahnstufe: neueMahnstufe,
        letzte_mahnung_am: new Date().toISOString(),
        naechste_mahnung_am: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 Tage später
      })
      .eq('id', mietvertragId);

    console.log(`Mahnstufe erhöht von ${mahnstufe} auf ${neueMahnstufe} für Mietvertrag ${mietvertragId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mahnung Stufe ${mahnstufe} erfolgreich versendet`,
        recipient: mieter.hauptmail,
        amount: gesamtbetrag
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-mahnung function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateMahnungstext(mahnstufe: number, mieter: any, vertrag: any, forderungen: any[], gesamtbetrag: number): string {
  const heute = new Date().toLocaleDateString('de-DE');
  const name = `${mieter.vorname} ${mieter.nachname}`;
  
  let betreff = '';
  let mahnungsart = '';
  let zusatztext = '';
  
  switch (mahnstufe) {
    case 1:
      betreff = '1. Mahnung - Mietrückstand';
      mahnungsart = 'erste Mahnung';
      zusatztext = 'Wir bitten Sie, den ausstehenden Betrag umgehend zu begleichen.';
      break;
    case 2:
      betreff = '2. Mahnung - Mietrückstand';
      mahnungsart = 'zweite Mahnung';
      zusatztext = 'Sollten Sie nicht innerhalb von 7 Tagen zahlen, behalten wir uns rechtliche Schritte vor.';
      break;
    case 3:
      betreff = '3. und letzte Mahnung - Mietrückstand';
      mahnungsart = 'dritte und letzte Mahnung';
      zusatztext = 'Bei Nichtzahlung innerhalb von 3 Tagen werden wir das Mietverhältnis kündigen und rechtliche Schritte einleiten.';
      break;
    default:
      betreff = 'Zahlungserinnerung';
      mahnungsart = 'Zahlungserinnerung';
      zusatztext = 'Bitte begleichen Sie den ausstehenden Betrag.';
  }

  const forderungsListe = forderungen.map(f => {
    const monat = new Date(f.sollmonat + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return `- ${monat}: ${parseFloat(f.sollbetrag).toFixed(2)}€`;
  }).join('\n');

  return `
Betreff: ${betreff}

Sehr geehrte/r ${name},

hiermit erhalten Sie unsere ${mahnungsart} bezüglich Ihres Mietrückstands.

Folgende Beträge sind noch offen:
${forderungsListe}

Gesamtbetrag: ${gesamtbetrag.toFixed(2)}€

${zusatztext}

Bitte überweisen Sie den Betrag auf das bekannte Konto oder setzen Sie sich umgehend mit uns in Verbindung.

Mit freundlichen Grüßen
Ihre Hausverwaltung

Datum: ${heute}
Mahnstufe: ${mahnstufe}
  `.trim();
}