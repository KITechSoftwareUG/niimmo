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

    const { 
      mietvertragIds,
      isEinzug,
      uebergabeDatum,
      schluessel,
      zaehlerstaendePerContract,
      protokollNotizen
    } = await req.json();

    if (!mietvertragIds || mietvertragIds.length === 0) {
      throw new Error('Mindestens eine Mietvertrag ID ist erforderlich');
    }

    console.log('Generating Übergabeprotokoll PDF for contracts:', mietvertragIds);

    // Fetch all contract details
    const { data: vertraege, error: vertragError } = await supabaseClient
      .from('mietvertrag')
      .select(`
        id,
        kaltmiete,
        betriebskosten,
        start_datum,
        ende_datum,
        strom_einzug,
        gas_einzug,
        kaltwasser_einzug,
        warmwasser_einzug,
        strom_auszug,
        gas_auszug,
        kaltwasser_auszug,
        warmwasser_auszug,
        einheiten!inner(
          id,
          etage,
          zaehler,
          qm,
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
      .in('id', mietvertragIds);

    if (vertragError) throw vertragError;
    if (!vertraege || vertraege.length === 0) throw new Error('Keine Verträge gefunden');

    const firstVertrag = vertraege[0];
    const mieterNames = firstVertrag.mietvertrag_mieter
      .map((m: any) => `${m.mieter.vorname} ${m.mieter.nachname}`)
      .join(', ');
    const mieterVorname = firstVertrag.mietvertrag_mieter[0].mieter.vorname;
    const mieterNachname = firstVertrag.mietvertrag_mieter[0].mieter.nachname;
    
    const datum = new Date(uebergabeDatum).toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const erstelltAm = new Date().toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create PDF with jsPDF
    const doc = new jsPDF();
    
    let yPos = 15;
    
    // Header with branding
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('NilImmo Gruppe', 20, yPos);
    yPos += 10;
    
    // Company header info
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text('NilImmo Projektentwicklung & Bau GmbH · Egonstraße 11 · 31319 Sehnde', 20, yPos);
    yPos += 15;
    
    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    const title = isEinzug ? 'ÜBERGABEPROTOKOLL - EINZUG' : 'ÜBERGABEPROTOKOLL - AUSZUG';
    doc.text(title, 20, yPos);
    yPos += 5;
    
    // Underline
    doc.setDrawColor(0, 102, 153);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 100, yPos);
    yPos += 15;
    
    // General Info Section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Allgemeine Informationen', 20, yPos);
    yPos += 8;
    
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    // Info Grid
    const infoData = [
      ['Übergabedatum:', datum],
      ['Erstellt am:', erstelltAm],
      ['Mieter:', mieterNames],
    ];
    
    infoData.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(value, 70, yPos);
      yPos += 6;
    });
    
    // Schlüsselübergabe Section
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('Übergebene Schlüssel:', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    
    const schluesselData = [
      ['Haustür:', schluessel?.haustuer || '0'],
      ['Wohnung:', schluessel?.wohnung || '0'],
      ['Briefkasten:', schluessel?.briefkasten || '0'],
      ['Keller:', schluessel?.keller || '0'],
    ];
    
    schluesselData.forEach(([label, value], index) => {
      const xOffset = index % 2 === 0 ? 25 : 100;
      if (index === 2) yPos += 6;
      doc.setFont(undefined, 'bold');
      doc.text(label, xOffset, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(`${value} Stück`, xOffset + 25, yPos);
    });
    yPos += 6;
    
    yPos += 10;

    // Units Section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Einheiten & Zählerstände', 20, yPos);
    yPos += 10;
    
    doc.setTextColor(0);
    
    // Loop through each contract/unit
    for (const vertrag of vertraege) {
      const immobilieName = vertrag.einheiten.immobilien.name;
      const adresse = vertrag.einheiten.immobilien.adresse;
      const etage = vertrag.einheiten.etage || 'EG';
      const qm = vertrag.einheiten.qm;
      const zaehlerstaende = zaehlerstaendePerContract?.[vertrag.id] || {};
      
      // Unit header
      doc.setFillColor(245, 245, 245);
      doc.rect(20, yPos - 5, 175, 8, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`${immobilieName} - ${etage}${qm ? ` (${qm} m²)` : ''}`, 22, yPos);
      yPos += 4;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(adresse, 22, yPos);
      yPos += 10;
      
      // Meter readings table header
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Zählerart', 25, yPos);
      doc.text('Zählerstand', 100, yPos);
      doc.text('Einheit', 150, yPos);
      yPos += 2;
      doc.setDrawColor(200);
      doc.line(25, yPos, 175, yPos);
      yPos += 6;
      
      // Meter readings data
      doc.setFont(undefined, 'normal');
      const meterReadings = [
        ['Strom', zaehlerstaende.strom || '-', 'kWh'],
        ['Gas', zaehlerstaende.gas || '-', 'm³'],
        ['Kaltwasser', zaehlerstaende.wasser || '-', 'm³'],
        ['Warmwasser', zaehlerstaende.warmwasser || '-', 'm³'],
      ];
      
      meterReadings.forEach(([type, value, unit]) => {
        doc.text(type, 25, yPos);
        doc.text(String(value), 100, yPos);
        doc.text(unit, 150, yPos);
        yPos += 5;
      });
      
      yPos += 10;
      
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    }
    
    // Notes Section
    if (protokollNotizen && protokollNotizen.trim()) {
      yPos += 5;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 153);
      doc.text('Bemerkungen / Zustand', 20, yPos);
      yPos += 8;
      
      doc.setTextColor(0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      
      // Split notes into lines
      const maxWidth = 170;
      const lines = doc.splitTextToSize(protokollNotizen, maxWidth);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos);
        yPos += 5;
      });
    }
    
    // Signature Section
    yPos += 20;
    if (yPos > 230) {
      doc.addPage();
      yPos = 40;
    }
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Unterschriften', 20, yPos);
    yPos += 15;
    
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    // Signature lines
    const sigY = yPos;
    
    // Left signature (Vermieter)
    doc.line(20, sigY + 20, 85, sigY + 20);
    doc.text('Vermieter / Bevollmächtigter', 20, sigY + 27);
    doc.text('Datum: ________________', 20, sigY + 35);
    
    // Right signature (Mieter)
    doc.line(110, sigY + 20, 175, sigY + 20);
    doc.text('Mieter', 110, sigY + 27);
    doc.text('Datum: ________________', 110, sigY + 35);
    
    // Footer with company details
    const footerY = 260;
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.line(20, footerY, 190, footerY);
    
    doc.setFont(undefined, 'bold');
    doc.text('NilImmo Projektentwicklung & Bau GmbH', 20, footerY + 5);
    doc.setFont(undefined, 'normal');
    doc.text('Egonstraße 11, 31319 Sehnde | Tel: 05138 - 600 72 79 | www.nilimmo.de', 20, footerY + 9);
    
    // Generate PDF as ArrayBuffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfArrayBuffer);

    // Generate filename
    const uebergabeTyp = isEinzug ? 'Einzug' : 'Auszug';
    const datumFormatted = datum.replace(/\./g, '-');
    const fileName = `Uebergabeprotokoll_${uebergabeTyp}_${mieterVorname}_${mieterNachname}_${datumFormatted}.pdf`;
    const filePath = `uebergabeprotokolle/${mietvertragIds[0]}/${fileName}`;

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

    // Save document reference in database for each contract
    for (const vertragId of mietvertragIds) {
      const { error: dbError } = await supabaseClient
        .from('dokumente')
        .insert({
          titel: `Übergabeprotokoll ${uebergabeTyp} ${datum}`,
          pfad: filePath,
          kategorie: 'Übergabeprotokoll',
          dateityp: 'application/pdf',
          mietvertrag_id: vertragId,
        });

      if (dbError) {
        console.error('Database error for contract', vertragId, ':', dbError);
      }
    }

    console.log('Übergabeprotokoll PDF successfully created and saved:', filePath);

    // Return success response with PDF data for immediate download
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Übergabeprotokoll PDF erfolgreich erstellt',
        filePath,
        fileName
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating Übergabeprotokoll PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
