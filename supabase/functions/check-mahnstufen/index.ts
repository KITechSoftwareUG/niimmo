import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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