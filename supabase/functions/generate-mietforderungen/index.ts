import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface Mietvertrag {
  id: string;
  kaltmiete: number | null;
  betriebskosten: number | null;
  start_datum: string | null;
  ende_datum: string | null;
  status: string;
  kuendigungsdatum: string | null;
}

interface Mietforderung {
  id: string;
  sollbetrag: number | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate current month (YYYY-MM)
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const currentMonth = `${year}-${month}`;
    const currentDate = today.toISOString().split('T')[0];

    console.log(`[generate-mietforderungen] Starting for month: ${currentMonth}`);

    // Fetch active and terminated contracts
    const { data: contracts, error: contractsError } = await supabase
      .from('mietvertrag')
      .select('id, kaltmiete, betriebskosten, start_datum, ende_datum, status, kuendigungsdatum')
      .or('status.eq.aktiv,status.eq.gekuendigt')
      .lte('start_datum', currentDate)
      .or(`ende_datum.is.null,ende_datum.gte.${currentDate}`)
      .or(`kuendigungsdatum.is.null,kuendigungsdatum.gt.${currentDate}`);

    if (contractsError) {
      console.error('Error fetching contracts:', contractsError);
      throw contractsError;
    }

    console.log(`[generate-mietforderungen] Found ${contracts?.length || 0} eligible contracts`);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const contract of (contracts || []) as Mietvertrag[]) {
      try {
        const kaltmiete = contract.kaltmiete || 0;
        const betriebskosten = contract.betriebskosten || 0;
        let sollbetrag = kaltmiete + betriebskosten;

        // Half-month logic: if contract starts in current month and day >= 14
        if (contract.start_datum) {
          const startDate = new Date(contract.start_datum);
          const startMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;
          
          if (startMonth === currentMonth && startDate.getDate() >= 14) {
            sollbetrag = sollbetrag / 2;
            console.log(`[generate-mietforderungen] Half-month applied for contract ${contract.id}`);
          }
        }

        // Round to 2 decimal places
        sollbetrag = Math.round(sollbetrag * 100) / 100;

        // Check if Mietforderung already exists
        const { data: existingForderung, error: checkError } = await supabase
          .from('mietforderungen')
          .select('id, sollbetrag')
          .eq('mietvertrag_id', contract.id)
          .eq('sollmonat', currentMonth)
          .maybeSingle();

        if (checkError) {
          console.error(`Error checking forderung for ${contract.id}:`, checkError);
          results.errors.push(`Check error for ${contract.id}: ${checkError.message}`);
          continue;
        }

        if (!existingForderung) {
          // Create new Mietforderung
          const { error: insertError } = await supabase
            .from('mietforderungen')
            .insert({
              mietvertrag_id: contract.id,
              sollmonat: currentMonth,
              sollbetrag: sollbetrag,
            });

          if (insertError) {
            console.error(`Error creating forderung for ${contract.id}:`, insertError);
            results.errors.push(`Insert error for ${contract.id}: ${insertError.message}`);
          } else {
            console.log(`[generate-mietforderungen] Created forderung for ${contract.id}: ${sollbetrag}€`);
            results.created++;
          }
        } else {
          // Check if amount needs updating
          const existingSollbetrag = existingForderung.sollbetrag || 0;
          
          if (Math.abs(existingSollbetrag - sollbetrag) > 0.01) {
            const { error: updateError } = await supabase
              .from('mietforderungen')
              .update({ sollbetrag: sollbetrag })
              .eq('id', existingForderung.id);

            if (updateError) {
              console.error(`Error updating forderung ${existingForderung.id}:`, updateError);
              results.errors.push(`Update error for ${existingForderung.id}: ${updateError.message}`);
            } else {
              console.log(`[generate-mietforderungen] Updated forderung ${existingForderung.id}: ${existingSollbetrag}€ -> ${sollbetrag}€`);
              results.updated++;
            }
          } else {
            results.skipped++;
          }
        }
      } catch (contractError) {
        console.error(`Error processing contract ${contract.id}:`, contractError);
        results.errors.push(`Processing error for ${contract.id}: ${String(contractError)}`);
      }
    }

    console.log(`[generate-mietforderungen] Completed:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        month: currentMonth,
        results,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[generate-mietforderungen] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
