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

    const { mietvertragId, neueKaltmiete, neueBetriebskosten } = await req.json();

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
    const aktuelleBetriebskosten = vertrag.betriebskosten || 0;
    const aktuelleGesamtmiete = aktuelleKaltmiete + aktuelleBetriebskosten;
    
    const neueKaltmieteValue = neueKaltmiete || aktuelleKaltmiete * 1.04;
    const neueBetriebskostenValue = neueBetriebskosten !== undefined ? neueBetriebskosten : aktuelleBetriebskosten;
    const neueGesamtmiete = neueKaltmieteValue + neueBetriebskostenValue;
    const erhoehung = neueGesamtmiete - aktuelleGesamtmiete;
    const erhoehungProzent = ((erhoehung / aktuelleGesamtmiete) * 100).toFixed(2);
    
    const datum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const wirksamDatum = new Date();
    wirksamDatum.setMonth(wirksamDatum.getMonth() + 3);
    const wirksamDatumStr = wirksamDatum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
      <strong>Mietobjekt:</strong> ${immobilieName}<br>
      <strong>Adresse:</strong> ${adresse}
    </div>

    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Position</th>
        <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Aktuell</th>
        <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Neu</th>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">Kaltmiete</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${aktuelleKaltmiete.toFixed(2)} €</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>${neueKaltmieteValue.toFixed(2)} €</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">Betriebskosten</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${aktuelleBetriebskosten.toFixed(2)} €</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>${neueBetriebskostenValue.toFixed(2)} €</strong></td>
      </tr>
      <tr style="background: #f5f5f5; font-weight: bold;">
        <td style="padding: 10px; border: 1px solid #ddd;">Gesamtmiete</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${aktuelleGesamtmiete.toFixed(2)} €</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${neueGesamtmiete.toFixed(2)} €</td>
      </tr>
      <tr style="color: #d97706;">
        <td style="padding: 10px; border: 1px solid #ddd;">Erhöhung</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">-</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>+${erhoehung.toFixed(2)} € (${erhoehungProzent}%)</strong></td>
      </tr>
    </table>

    <p>
      Die Erhöhung wird zum <strong>${wirksamDatumStr}</strong> wirksam. Die neue Gesamtmiete beträgt dann <strong>${neueGesamtmiete.toFixed(2)} €</strong> monatlich.
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

    // Save as HTML (can be printed to PDF by browser)
    const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
    const fileName = `Mieterhoehung_${mieterName.replace(/\s+/g, '_')}_${datum.replace(/\./g, '-')}.html`;
    const filePath = `mieterhoehungen/${mietvertragId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseClient.storage
      .from('dokumente')
      .upload(filePath, htmlBlob, {
        contentType: 'text/html; charset=utf-8',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Create database entry
    const { error: dbError } = await supabaseClient
      .from('dokumente')
      .insert({
        mietvertrag_id: mietvertragId,
        titel: `Mieterhöhung ${datum} - ${mieterName}`,
        pfad: filePath,
        kategorie: 'Mietvertrag',
        dateityp: 'text/html'
      });

    if (dbError) throw dbError;

    console.log('Mieterhöhung successfully created and saved:', filePath);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mieterhöhung erfolgreich erstellt',
        filePath,
        fileName
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
