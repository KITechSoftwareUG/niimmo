import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface FaelligeForderung {
  forderung_id: string;
  mietvertrag_id: string;
  sollmonat: string;
  sollbetrag: number;
  faelligkeitsdatum: string;
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
    console.log('🔍 Starte tägliche Fälligkeitsprüfung...');
    
    // Supabase Client initialisieren
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Führe die Fälligkeitsprüfung aus
    const { data: faelligeForderungen, error: updateError } = await supabase
      .rpc('update_faellige_forderungen');

    if (updateError) {
      console.error('❌ Fehler beim Aktualisieren der Fälligkeiten:', updateError);
      throw updateError;
    }

    const anzahlNeueRueckstaende = faelligeForderungen?.length || 0;
    console.log(`✅ ${anzahlNeueRueckstaende} Forderungen als fällig markiert`);

    // Detailliertes Logging für jede neue fällige Forderung
    if (faelligeForderungen && faelligeForderungen.length > 0) {
      for (const forderung of faelligeForderungen as FaelligeForderung[]) {
        console.log(`📋 Neue fällige Forderung:`, {
          sollmonat: forderung.sollmonat,
          sollbetrag: forderung.sollbetrag,
          faelligkeitsdatum: forderung.faelligkeitsdatum,
          mietvertrag_id: forderung.mietvertrag_id.substring(0, 8) + '...'
        });
      }
    }

    // Statistik über alle Forderungen abfragen
    const { data: statistik, error: statsError } = await supabase
      .from('mietforderungen')
      .select('ist_faellig, faelligkeitsdatum')
      .order('faelligkeitsdatum');

    if (statsError) {
      console.warn('⚠️ Konnte Statistik nicht abrufen:', statsError);
    } else {
      const gesamt = statistik?.length || 0;
      const faellig = statistik?.filter(f => f.ist_faellig).length || 0;
      const nochNichtFaellig = gesamt - faellig;
      
      console.log(`📊 Forderungsstatistik:`, {
        gesamt,
        faellig,
        nochNichtFaellig,
        datum: new Date().toISOString().split('T')[0]
      });
    }

    // Log in system_logs Tabelle für Nachverfolgung
    const { error: logError } = await supabase
      .from('system_logs')
      .insert({
        message: `Fälligkeitsprüfung abgeschlossen: ${anzahlNeueRueckstaende} neue fällige Forderungen markiert`
      });

    if (logError) {
      console.warn('⚠️ Konnte System-Log nicht schreiben:', logError);
    }

    // Erfolgreiche Antwort
    return new Response(
      JSON.stringify({
        success: true,
        message: `Fälligkeitsprüfung erfolgreich abgeschlossen`,
        neueRueckstaende: anzahlNeueRueckstaende,
        timestamp: new Date().toISOString(),
        details: faelligeForderungen || []
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('💥 Fehler bei Fälligkeitsprüfung:', error);
    
    // Fehler-Log in system_logs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('system_logs')
        .insert({
          message: `FEHLER bei Fälligkeitsprüfung: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    } catch (logError) {
      console.error('Konnte Fehler-Log nicht schreiben:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});