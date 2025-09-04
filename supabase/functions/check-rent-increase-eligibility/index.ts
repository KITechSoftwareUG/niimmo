import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RentIncreaseEligibility {
  mietvertrag_id: string;
  current_kaltmiete: number;
  letzte_mieterhoehung_am: string | null;
  start_datum: string;
  is_eligible: boolean;
  months_since_last_increase: number;
  months_since_start: number;
  reason: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking rent increase eligibility...');

    // Fetch all active rental contracts
    const { data: contracts, error } = await supabase
      .from('mietvertrag')
      .select(`
        id,
        kaltmiete,
        betriebskosten,
        letzte_mieterhoehung_am,
        start_datum,
        status
      `)
      .eq('status', 'aktiv');

    if (error) {
      console.error('Error fetching contracts:', error);
      throw error;
    }

    const eligibleContracts: RentIncreaseEligibility[] = [];
    const currentDate = new Date();

    for (const contract of contracts || []) {
      const startDate = new Date(contract.start_datum);
      const lastIncreaseDate = contract.letzte_mieterhoehung_am 
        ? new Date(contract.letzte_mieterhoehung_am) 
        : null;

      // Calculate months since start
      const monthsSinceStart = Math.floor(
        (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      // Calculate months since last increase (or since start if never increased)
      const referenceDate = lastIncreaseDate || startDate;
      const monthsSinceLastIncrease = Math.floor(
        (currentDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      let isEligible = false;
      let reason = '';

      // German rent increase rules:
      // - At least 15 months since last increase
      // - At least 15 months since move-in if never increased
      if (monthsSinceLastIncrease >= 15) {
        isEligible = true;
        reason = lastIncreaseDate 
          ? `${monthsSinceLastIncrease} Monate seit letzter Erhöhung`
          : `${monthsSinceStart} Monate seit Vertragsbeginn`;
      } else {
        const monthsRemaining = 15 - monthsSinceLastIncrease;
        reason = `Noch ${monthsRemaining} Monate bis zur nächsten möglichen Erhöhung`;
      }

      const eligibilityInfo: RentIncreaseEligibility = {
        mietvertrag_id: contract.id,
        current_kaltmiete: contract.kaltmiete,
        letzte_mieterhoehung_am: contract.letzte_mieterhoehung_am,
        start_datum: contract.start_datum,
        is_eligible: isEligible,
        months_since_last_increase: monthsSinceLastIncrease,
        months_since_start: monthsSinceStart,
        reason
      };

      eligibleContracts.push(eligibilityInfo);
    }

    // Filter for only eligible contracts
    const eligibleOnly = eligibleContracts.filter(c => c.is_eligible);

    console.log(`Found ${eligibleOnly.length} contracts eligible for rent increase`);

    return new Response(
      JSON.stringify({
        success: true,
        eligible_contracts: eligibleOnly,
        total_eligible: eligibleOnly.length,
        all_contracts: eligibleContracts
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in rent increase eligibility check:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

serve(handler)