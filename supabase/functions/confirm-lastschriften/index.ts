import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmationResult {
  zahlungId: string;
  mietvertragId: string;
  betrag: number;
  buchungsdatum: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const heute = new Date();
    const confirmedPayments: ConfirmationResult[] = [];
    
    // Get all unconfirmed payments (lastschrift_bestaetigt_am IS NULL) 
    // for contracts with lastschrift = true
    const { data: unconfirmedPayments, error: fetchError } = await supabase
      .from('zahlungen')
      .select(`
        id,
        mietvertrag_id,
        betrag,
        buchungsdatum,
        lastschrift_bestaetigt_am,
        mietvertrag:mietvertrag_id (
          id,
          lastschrift,
          lastschrift_wartetage
        )
      `)
      .is('lastschrift_bestaetigt_am', null)
      .not('mietvertrag_id', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching unconfirmed payments:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${unconfirmedPayments?.length || 0} unconfirmed payments to check`);
    
    // Filter and confirm payments where waiting period has passed
    for (const payment of unconfirmedPayments || []) {
      const mietvertrag = payment.mietvertrag as any;
      
      // Skip if contract doesn't use Lastschrift
      if (!mietvertrag?.lastschrift) {
        // Confirm immediately since it's not a Lastschrift contract
        const { error: updateError } = await supabase
          .from('zahlungen')
          .update({ lastschrift_bestaetigt_am: heute.toISOString() })
          .eq('id', payment.id);
        
        if (!updateError) {
          confirmedPayments.push({
            zahlungId: payment.id,
            mietvertragId: payment.mietvertrag_id,
            betrag: payment.betrag,
            buchungsdatum: payment.buchungsdatum,
          });
        }
        continue;
      }
      
      const wartetage = mietvertrag.lastschrift_wartetage || 4;
      const buchungsdatum = new Date(payment.buchungsdatum);
      const daysSincePayment = Math.floor((heute.getTime() - buchungsdatum.getTime()) / (1000 * 60 * 60 * 24));
      
      // If waiting period has passed, confirm the payment
      if (daysSincePayment >= wartetage) {
        const { error: updateError } = await supabase
          .from('zahlungen')
          .update({ lastschrift_bestaetigt_am: heute.toISOString() })
          .eq('id', payment.id);
        
        if (updateError) {
          console.error(`Error confirming payment ${payment.id}:`, updateError);
          continue;
        }
        
        confirmedPayments.push({
          zahlungId: payment.id,
          mietvertragId: payment.mietvertrag_id,
          betrag: payment.betrag,
          buchungsdatum: payment.buchungsdatum,
        });
        
        console.log(`Confirmed payment ${payment.id} - ${wartetage} day waiting period passed`);
      }
    }
    
    // Log the results
    if (confirmedPayments.length > 0) {
      await supabase.from('system_logs').insert({
        message: `Lastschrift-Bestätigung: ${confirmedPayments.length} Zahlungen bestätigt`,
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        confirmedCount: confirmedPayments.length,
        confirmedPayments,
        checkedCount: unconfirmedPayments?.length || 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('Error in confirm-lastschriften:', error);
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
});
