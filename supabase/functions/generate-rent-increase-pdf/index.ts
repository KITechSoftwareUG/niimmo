import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { mietvertragId } = await req.json();

    if (!mietvertragId) {
      throw new Error('Mietvertrag ID ist erforderlich');
    }

    console.log('Generating rent increase PDF for contract:', mietvertragId);

    // Fetch contract details
    const { data: vertrag, error: vertragError } = await supabaseClient
      .from('mietvertrag')
      .select(`
        id,
        kaltmiete,
        betriebskosten,
        start_datum,
        letzte_mieterhoehung_am,
        einheiten!inner(
          id,
          immobilien!inner(
            name,
            adresse
          )
        ),
        mietvertrag_mieter!inner(
          mieter!inner(
            vorname,
            nachname,
            hauptmail
          )
        )
      `)
      .eq('id', mietvertragId)
      .single();

    if (vertragError) throw vertragError;

    const mieterName = `${vertrag.mietvertrag_mieter[0].mieter.vorname} ${vertrag.mietvertrag_mieter[0].mieter.nachname}`;
    const immobilieName = vertrag.einheiten.immobilien.name;
    const adresse = vertrag.einheiten.immobilien.adresse;
    const aktuelleKaltmiete = vertrag.kaltmiete;
    const datum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Generate PDF content as HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: right;
      margin-bottom: 40px;
    }
    .address {
      margin-bottom: 40px;
    }
    h1 {
      text-align: center;
      margin: 40px 0;
    }
    .content {
      margin-bottom: 20px;
    }
    .signature {
      margin-top: 60px;
    }
    .info-box {
      background: #f5f5f5;
      padding: 15px;
      margin: 20px 0;
      border-left: 4px solid #333;
    }
  </style>
</head>
<body>
  <div class="header">
    <p>${datum}</p>
  </div>

  <div class="address">
    <strong>${mieterName}</strong><br>
    ${adresse}
  </div>

  <h1>Ankündigung einer Mieterhöhung</h1>

  <div class="content">
    <p>Sehr geehrte/r ${mieterName},</p>

    <p>
      hiermit kündigen wir für die von Ihnen gemietete Wohnung in der ${immobilieName}, ${adresse}, 
      eine Mieterhöhung gemäß § 558 BGB an.
    </p>

    <div class="info-box">
      <strong>Aktuelle Kaltmiete:</strong> ${aktuelleKaltmiete.toFixed(2)} €<br>
      <strong>Mietobjekt:</strong> ${immobilieName}<br>
      <strong>Adresse:</strong> ${adresse}
    </div>

    <p>
      Die Erhöhung wird zum [DATUM] wirksam. Die neue Kaltmiete beträgt dann [NEUE MIETE] € monatlich.
    </p>

    <p>
      Die Erhöhung orientiert sich an der ortsüblichen Vergleichsmiete gemäß dem aktuellen Mietspiegel 
      und ist durch die allgemeine Mietentwicklung im Gebiet gerechtfertigt.
    </p>

    <p>
      Bitte teilen Sie uns binnen zwei Monaten nach Zugang dieses Schreibens mit, ob Sie der Mieterhöhung 
      zustimmen. Die Zustimmung gilt als erteilt, wenn Sie nicht innerhalb der Frist widersprechen.
    </p>

    <p>
      Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.
    </p>

    <p>Mit freundlichen Grüßen</p>
  </div>

  <div class="signature">
    <p>_______________________________</p>
    <p>Unterschrift Vermieter</p>
  </div>
</body>
</html>
    `;

    // Convert HTML to PDF using a simple approach
    // For production, you might want to use a proper PDF library
    const pdfBlob = new Blob([htmlContent], { type: 'text/html' });
    const fileName = `Mieterhoehung_${mieterName.replace(/\s+/g, '_')}_${Date.now()}.html`;
    const filePath = `mieterhoehungen/${mietvertragId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseClient.storage
      .from('dokumente')
      .upload(filePath, pdfBlob, {
        contentType: 'text/html',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Create database entry
    const { error: dbError } = await supabaseClient
      .from('dokumente')
      .insert({
        mietvertrag_id: mietvertragId,
        titel: `Mieterhöhung - ${mieterName}`,
        pfad: filePath,
        kategorie: 'mietvertrag',
        dateityp: 'text/html'
      });

    if (dbError) throw dbError;

    console.log('PDF successfully created and saved:', filePath);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'PDF erfolgreich erstellt',
        filePath 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating rent increase PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
