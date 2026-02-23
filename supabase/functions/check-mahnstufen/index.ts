import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

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

    console.log('Starting Mahnstufen check...')

    // Rufe die Datenbank-Funktion auf
    const { data, error } = await supabase.rpc('check_and_update_mahnstufen')

    if (error) {
      console.error('Error calling check_and_update_mahnstufen:', error)
      throw error
    }

    console.log('Mahnstufen check completed. Results:', data)

    // Log die Ergebnisse
    if (data && data.length > 0) {
      for (const result of data) {
        console.log(`Mietvertrag ${result.mietvertrag_id}: Mahnstufe ${result.alte_mahnstufe} → ${result.neue_mahnstufe} (${result.grund})`)
        
        // Optional: Füge einen Eintrag in die system_logs Tabelle hinzu
        await supabase
          .from('system_logs')
          .insert({
            message: `Mahnstufe automatisch erhöht für Mietvertrag ${result.mietvertrag_id}: ${result.alte_mahnstufe} → ${result.neue_mahnstufe}. Grund: ${result.grund}`
          })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mahnstufen-Prüfung abgeschlossen. ${data?.length || 0} Verträge aktualisiert.`,
        results: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in check-mahnstufen function:', error)
    
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