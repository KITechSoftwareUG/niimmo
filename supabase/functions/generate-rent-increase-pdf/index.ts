import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { jsPDF } from 'npm:jspdf@2.5.2';

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
    const mieterVorname = vertrag.mietvertrag_mieter[0].mieter.vorname;
    const mieterNachname = vertrag.mietvertrag_mieter[0].mieter.nachname;
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

    // Create PDF with jsPDF
    const doc = new jsPDF();
    
    let yPos = 20;
    
    // Sender info
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(immobilieName, 20, yPos);
    yPos += 5;
    doc.text(adresse, 20, yPos);
    yPos += 15;
    
    // Recipient
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(mieterName, 20, yPos);
    yPos += 6;
    doc.text(adresse, 20, yPos);
    yPos += 15;
    
    // Date
    doc.setFontSize(10);
    doc.text(datum, 150, yPos);
    yPos += 15;
    
    // Subject
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Mieterhöhung gemäß § 558 BGB', 20, yPos);
    yPos += 12;
    
    // Body text
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Sehr geehrte/r ${mieterName},`, 20, yPos);
    yPos += 10;
    
    const text1 = `hiermit erhöhen wir die Miete für die von Ihnen gemietete Wohnung in`;
    doc.text(text1, 20, yPos);
    yPos += 6;
    doc.text(`${immobilieName}, ${adresse}, zum ${wirksamDatumStr}.`, 20, yPos);
    yPos += 10;
    
    doc.text('Die Mieterhöhung stellt sich wie folgt dar:', 20, yPos);
    yPos += 12;
    
    // Table
    const colWidths = [70, 35, 35, 35];
    const colX = [20, 90, 125, 160];
    
    // Table header
    doc.setFont(undefined, 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(20, yPos - 5, 175, 8, 'F');
    doc.text('Position', colX[0] + 2, yPos);
    doc.text('Aktuell', colX[1] + 2, yPos);
    doc.text('Neu', colX[2] + 2, yPos);
    doc.text('Differenz', colX[3] + 2, yPos);
    yPos += 10;
    
    // Table rows
    doc.setFont(undefined, 'normal');
    
    // Kaltmiete
    doc.text('Kaltmiete', colX[0] + 2, yPos);
    doc.text(`${aktuelleKaltmiete.toFixed(2)} €`, colX[1] + 2, yPos);
    doc.text(`${neueKaltmieteValue.toFixed(2)} €`, colX[2] + 2, yPos);
    doc.text(`${(neueKaltmieteValue - aktuelleKaltmiete).toFixed(2)} €`, colX[3] + 2, yPos);
    yPos += 8;
    
    // Betriebskosten
    doc.text('Betriebskosten', colX[0] + 2, yPos);
    doc.text(`${aktuelleBetriebskosten.toFixed(2)} €`, colX[1] + 2, yPos);
    doc.text(`${neueBetriebskostenValue.toFixed(2)} €`, colX[2] + 2, yPos);
    doc.text(`${(neueBetriebskostenValue - aktuelleBetriebskosten).toFixed(2)} €`, colX[3] + 2, yPos);
    yPos += 8;
    
    // Total
    doc.setFont(undefined, 'bold');
    doc.setFillColor(249, 249, 249);
    doc.rect(20, yPos - 5, 175, 8, 'F');
    doc.text('Gesamtmiete', colX[0] + 2, yPos);
    doc.text(`${aktuelleGesamtmiete.toFixed(2)} €`, colX[1] + 2, yPos);
    doc.text(`${neueGesamtmiete.toFixed(2)} €`, colX[2] + 2, yPos);
    doc.text(`${erhoehung.toFixed(2)} €`, colX[3] + 2, yPos);
    yPos += 8;
    
    // Increase percentage
    doc.setFillColor(255, 243, 205);
    doc.rect(20, yPos - 5, 175, 8, 'F');
    doc.text('Erhöhung in %', colX[0] + 2, yPos);
    doc.text(`${erhoehungProzent}%`, colX[3] + 2, yPos);
    yPos += 15;
    
    // More body text
    doc.setFont(undefined, 'normal');
    const text2 = `Die erhöhte Miete wird zum ${wirksamDatumStr} fällig. Wir bitten Sie, Ihre Zahlungen`;
    doc.text(text2, 20, yPos);
    yPos += 6;
    doc.text('entsprechend anzupassen.', 20, yPos);
    yPos += 12;
    
    const legalText = doc.splitTextToSize(
      'Gemäß § 558b BGB haben Sie das Recht, der Mieterhöhung bis zum Ende des zweiten Kalendermonats nach dem Zugang dieses Erhöhungsverlangens zu widersprechen. Sofern Sie nicht widersprechen, gilt Ihre Zustimmung als erteilt.',
      170
    );
    doc.text(legalText, 20, yPos);
    yPos += (legalText.length * 6) + 15;
    
    // Signature
    doc.text('Mit freundlichen Grüßen', 20, yPos);
    yPos += 10;
    doc.text(immobilieName, 20, yPos);
    
    // Footer
    yPos = 260;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.line(20, yPos, 190, yPos);
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('Rechtliche Hinweise:', 20, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    const footerText = doc.splitTextToSize(
      'Diese Mieterhöhung erfolgt gemäß § 558 BGB (Mieterhöhung bis zur ortsüblichen Vergleichsmiete). Bei Fragen wenden Sie sich bitte an uns.',
      170
    );
    doc.text(footerText, 20, yPos);
    
    // Generate PDF as ArrayBuffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfArrayBuffer);

    // Generate filename
    const fileName = `Mieterhoehung_${mieterVorname}_${mieterNachname}_${datum.replace(/\./g, '-')}.pdf`;
    const filePath = `mieterhoehungen/${mietvertragId}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabaseClient.storage
      .from('dokumente')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload PDF to storage');
    }

    // Save document reference in database
    const { error: dbError } = await supabaseClient
      .from('dokumente')
      .insert({
        titel: `Mieterhöhung ${datum}`,
        pfad: filePath,
        kategorie: 'Schriftverkehr',
        dateityp: 'application/pdf',
        mietvertrag_id: mietvertragId,
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log('Mieterhöhung PDF successfully created and saved:', filePath);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mieterhöhung PDF erfolgreich erstellt',
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
