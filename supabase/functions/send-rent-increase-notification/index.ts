import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RentIncreaseNotificationRequest {
  vertragId: string;
  mieterName: string;
  immobilieName: string;
  einheitId: string;
  aktuelleKaltmiete: number;
  aktuelleBetriebskosten: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      vertragId, 
      mieterName, 
      immobilieName, 
      einheitId, 
      aktuelleKaltmiete, 
      aktuelleBetriebskosten 
    }: RentIncreaseNotificationRequest = await req.json();

    console.log('Rent increase notification requested for:', {
      vertragId,
      mieterName,
      immobilieName,
      einheitId
    });

    // Calculate total current rent
    const aktuelleGesamtmiete = (aktuelleKaltmiete || 0) + (aktuelleBetriebskosten || 0);

    // For demonstration purposes, we'll simulate a rent increase calculation
    // In practice, this would be calculated based on local market rates, inflation indices, etc.
    const vorgeschlageneKaltmiete = (aktuelleKaltmiete || 0) * 1.04; // 4% increase example
    const neueGesamtmiete = vorgeschlageneKaltmiete + (aktuelleBetriebskosten || 0);
    const erhoehungsBetrag = neueGesamtmiete - aktuelleGesamtmiete;

    // Create notification message
    const notificationMessage = `
🏠 Mieterhöhungsbenachrichtigung

Mietvertrag: ${vertragId}
Mieter: ${mieterName}
Immobilie: ${immobilieName}
Einheit: ${einheitId}

💰 Aktuelle Miete:
- Kaltmiete: ${(aktuelleKaltmiete || 0).toLocaleString()} €
- Betriebskosten: ${(aktuelleBetriebskosten || 0).toLocaleString()} €
- Gesamtmiete: ${aktuelleGesamtmiete.toLocaleString()} €

💰 Vorgeschlagene neue Miete:
- Neue Kaltmiete: ${vorgeschlageneKaltmiete.toLocaleString()} €
- Betriebskosten: ${(aktuelleBetriebskosten || 0).toLocaleString()} €
- Neue Gesamtmiete: ${neueGesamtmiete.toLocaleString()} €
- Erhöhung: +${erhoehungsBetrag.toLocaleString()} €

📅 Hinweise:
- Die neue Miete wird 3 Monate nach Zugang des Schreibens wirksam
- Mieterhöhungen sind frühestens 15 Monate nach Einzug oder der letzten Erhöhung möglich
- Eine Erhöhung darf höchstens alle 12 Monate verlangt werden

⚖️ Bitte prüfen Sie die rechtlichen Bestimmungen und lokalen Mietobergrenzen vor der Umsetzung.
    `;

    console.log('Notification prepared:', notificationMessage);

    // In a real implementation, you would:
    // 1. Send an email notification to the landlord
    // 2. Save the notification to a database table
    // 3. Generate a formal rent increase letter document
    // 4. Update the contract with the proposed increase date

    // For now, we'll just log the notification and return success
    const response = {
      success: true,
      message: 'Mieterhöhungsbenachrichtigung wurde erstellt',
      data: {
        vertragId,
        mieterName,
        immobilieName,
        einheitId,
        aktuelleGesamtmiete: aktuelleGesamtmiete.toFixed(2),
        neueGesamtmiete: neueGesamtmiete.toFixed(2),
        erhoehungsBetrag: erhoehungsBetrag.toFixed(2),
        erhoehungsprozent: ((erhoehungsBetrag / aktuelleGesamtmiete) * 100).toFixed(2),
        wirksamkeitsdatum: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months from now
        notificationText: notificationMessage
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in rent increase notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);