import { jsPDF } from 'jspdf';

export interface MahnungPdfData {
  // Empfänger
  anrede: string; // "Herr" / "Frau" / "Herr und Frau"
  mieterName: string;
  mieterNachname: string;
  mieterAdresse: string; // Straße
  mieterPlzOrt: string; // PLZ + Ort
  
  // Vertrag
  einheitBezeichnung: string; // z.B. "WE 3"
  immobilieAdresse: string; // z.B. "Bahnhofstraße 18, 30952 Ronnenberg OT Weetzen"
  vertragStart: string; // z.B. "01.10.2024"
  
  // Mahnung
  mahnstufe: number;
  datum: string; // z.B. "04.09.2025"
  
  // Forderungen
  offeneForderungen: Array<{
    monat: string; // z.B. "Oktober 2024"
    betrag: number;
  }>;
  gesamtRueckstand: number;
  anzahlMonatsmieten: number;
  
  // Kosten
  verzugszinsenDetails: Array<{
    monat: string;
    betrag: number;
    laufend?: boolean;
  }>;
  verzugszinsenGesamt: number;
  mahnkostenProSchreiben: number;
  anzahlMahnschreiben: number;
  mahnkostenGesamt: number;
  
  // Zahlungsfrist
  zahlungsfristDatum: string;
  raeumungsfristDatum?: string;
  
  // Freitext
  freitext?: string;
}

// Load logo as base64 - cached
let logoBase64Cache: string | null = null;

async function loadLogo(): Promise<string | null> {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const response = await fetch('/nilimmo-logo.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateMahnungPdf(data: MahnungPdfData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  // ============ HEADER ============
  // Logo
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, 'PNG', 75, 8, 60, 35);
  }
  
  // Red separator line
  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, 48, pageWidth - marginRight, 48);
  
  // ============ SENDER LINE ============
  let y = 55;
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  // Underlined sender line
  const senderLine = 'Nilmmo Projektentwicklung & Bau GmbH, Egestorffstraße 11, 31319 Sehnde';
  doc.text(senderLine, marginLeft, y);
  const senderWidth = doc.getTextWidth(senderLine);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, y + 0.5, marginLeft + senderWidth, y + 0.5);
  
  // ============ RECIPIENT ============
  y = 63;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(data.anrede, marginLeft, y);
  y += 6;
  doc.text(data.mieterName, marginLeft, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(data.mieterAdresse, marginLeft, y);
  y += 6;
  doc.text(data.mieterPlzOrt, marginLeft, y);
  
  // ============ CONTACT BOX (right side) ============
  const contactX = 130;
  let contactY = 58;
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Rückfragen richten Sie bitte an:', contactX, contactY);
  contactY += 5;
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Denis Baris Mikyas', contactX, contactY);
  contactY += 5;
  doc.setFontSize(7);
  // Phone icon + number
  doc.text('\u260E   05138 – 600 72 72', contactX, contactY);
  contactY += 4;
  doc.text('\u2399   05138 – 600 72 79', contactX, contactY);
  contactY += 4;
  doc.text('     Egestorffstraße 11, 31319 Sehnde', contactX, contactY);
  contactY += 4;
  doc.text('\u2709   mikyas@niimmo.de', contactX, contactY);
  
  // ============ DATE ============
  y = 105;
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const dateText = `Sehnde, ${data.datum}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, pageWidth - marginRight - dateWidth, y);
  
  // ============ SUBJECT ============
  y = 120;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  const subjectLine1 = `MV – ${data.immobilieAdresse}, ${data.einheitBezeichnung}`;
  doc.text(subjectLine1, marginLeft, y);
  y += 6;
  
  let subjectLine2: string;
  if (data.mahnstufe >= 3) {
    subjectLine2 = 'Mahnung und fristlose Kündigung des Mietvertrages wegen Zahlungsverzuges';
  } else if (data.mahnstufe === 2) {
    subjectLine2 = '2. Mahnung wegen Zahlungsverzuges';
  } else {
    subjectLine2 = 'Zahlungserinnerung / 1. Mahnung';
  }
  doc.text(subjectLine2, marginLeft, y);
  
  // ============ BODY TEXT ============
  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const salutation = `Sehr geehrter ${data.anrede} ${data.mieterNachname},`;
  doc.text(salutation, marginLeft, y);
  y += 8;
  
  // Main body
  const lineHeight = 5;
  
  if (data.freitext) {
    // Use custom text
    const lines = doc.splitTextToSize(data.freitext, contentWidth);
    doc.text(lines, marginLeft, y);
    y += lines.length * lineHeight + 4;
  } else {
    // Default text based on Mahnstufe
    let bodyLines: string[];
    
    if (data.mahnstufe >= 3) {
      bodyLines = [
        `Sie haben seit Beginn des Mietverhältnisses am ${data.vertragStart} Ihre Mietzahlungen wiederholt`,
        `verspätet und unregelmäßig erbracht. Trotz meiner Mahnung sind die`,
        `Mietrückstände nicht ausgeglichen worden.`,
        `Der Mietrückstand beläuft sich inzwischen auf ${data.anzahlMonatsmieten} Monatsmieten in Höhe von insgesamt ${formatEuro(data.gesamtRueckstand)}`,
        `€. Damit befinden Sie sich im erheblichen Zahlungsverzug im Sinne der §§ 543 Abs. 2 Nr. 3, 569 Abs.`,
        `3 Nr. 1 BGB.`,
      ];
    } else if (data.mahnstufe === 2) {
      bodyLines = [
        `trotz unserer ersten Mahnung sind die folgenden Zahlungen weiterhin nicht bei`,
        `uns eingegangen. Wir fordern Sie hiermit erneut zur Zahlung auf.`,
        ``,
        `Der Mietrückstand beläuft sich auf insgesamt ${formatEuro(data.gesamtRueckstand)} €.`,
      ];
    } else {
      bodyLines = [
        `wir möchten Sie darauf hinweisen, dass folgende Mietzahlungen noch nicht bei`,
        `uns eingegangen sind:`,
        ``,
        `Der Mietrückstand beläuft sich auf insgesamt ${formatEuro(data.gesamtRueckstand)} €.`,
      ];
    }
    
    bodyLines.forEach(line => {
      if (line === '') {
        y += 3;
      } else {
        doc.text(line, marginLeft, y);
        y += lineHeight;
      }
    });
    y += 4;
  }
  
  // ============ VERZUGSZINSEN ============
  if (data.verzugszinsenDetails.length > 0) {
    y += 2;
    const zinsenIntro = doc.splitTextToSize(
      'Zusätzlich schulden Sie für die nicht bzw. verspätet gezahlten Mieten Verzugszinsen nach § 288 BGB. Bis zum heutigen Tage belaufen sich diese auf:',
      contentWidth
    );
    doc.text(zinsenIntro, marginLeft, y);
    y += zinsenIntro.length * lineHeight + 3;
    
    // List each month
    data.verzugszinsenDetails.forEach(detail => {
      const line = detail.laufend
        ? `${detail.monat}: ab ${data.datum} weiter laufend`
        : `${detail.monat}: ${formatEuro(detail.betrag)} €`;
      doc.text(line, marginLeft + 5, y);
      y += lineHeight;
    });
    
    y += 2;
    doc.text(`Zwischensumme Verzugszinsen: ${formatEuro(data.verzugszinsenGesamt)} € (zuzüglich weiterer Zinsen bis zur vollständigen Zahlung).`, marginLeft, y);
    y += lineHeight;
  }
  
  // Mahnkosten
  if (data.mahnkostenGesamt > 0) {
    doc.text(
      `Weiterhin entstehen Mahnkosten i. H. v. ${formatEuro(data.mahnkostenProSchreiben)} € pro Mahnschreiben, somit ${formatEuro(data.mahnkostenGesamt)} €.`,
      marginLeft, y
    );
    y += lineHeight + 4;
  }
  
  // ============ KÜNDIGUNG (Stufe 3) ============
  if (data.mahnstufe >= 3) {
    const kuendigungText = doc.splitTextToSize(
      `Hiermit kündige ich daher das bestehende Mietverhältnis über die Wohnung in der ${data.immobilieAdresse}, ${data.einheitBezeichnung} außerordentlich fristlos. Wir fordern Sie auf die Wohnung unverzüglich, spätestens jedoch bis zum ${data.raeumungsfristDatum || data.zahlungsfristDatum} zu räumen.`,
      contentWidth
    );
    doc.setFont('helvetica', 'normal');
    doc.text(kuendigungText, marginLeft, y);
    y += kuendigungText.length * lineHeight + 4;
    
    const fristText = doc.splitTextToSize(
      `Unabhängig hiervon setze ich Ihnen – ohne Anerkennung einer Rechtspflicht – eine Frist von 7 Kalendertagen, spätestens bis zum ${data.zahlungsfristDatum}, um sämtliche Mietrückstände nebst Zinsen vollständig auszugleichen. Sollten Sie die Rückstände nicht innerhalb dieser Frist begleichen, werde ich die fristlose Kündigung vollumfänglich durchsetzen und Räumungsklage erheben.`,
      contentWidth
    );
    doc.text(fristText, marginLeft, y);
    y += fristText.length * lineHeight + 4;
  } else {
    // Normal payment request
    const zahlungsText = doc.splitTextToSize(
      `Wir bitten Sie, den Gesamtbetrag bis zum ${data.zahlungsfristDatum} auf unser Konto zu überweisen.`,
      contentWidth
    );
    doc.text(zahlungsText, marginLeft, y);
    y += zahlungsText.length * lineHeight + 4;
    
    if (data.mahnstufe === 2) {
      doc.text('Bei ausbleibender Zahlung behalten wir uns rechtliche Schritte vor.', marginLeft, y);
      y += lineHeight + 4;
    }
  }
  
  // Contact closing
  doc.text('Für Rückfragen stehen wir Ihnen gerne unter den oben genannten Kontaktdaten zur Verfügung.', marginLeft, y);
  y += lineHeight + 8;
  
  // ============ SIGNATURE ============
  doc.text('Mit freundlichem Gruß', marginLeft, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.text('Denis Mikyas', marginLeft, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Geschäftsführer', marginLeft, y);
  
  // ============ FOOTER ============
  const footerY = 252;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY);
  
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  // Left column
  let fy = footerY + 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Vertretungsberechtigte Geschäftsführer:', marginLeft, fy);
  doc.setFont('helvetica', 'normal');
  doc.text('Ayhan Yeyrek, Denis Mikyas', marginLeft, fy + 3);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Registergericht:', marginLeft, fy + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Amtsgericht Hildesheim Handelsregister B', marginLeft, fy + 10);
  doc.text('Registernummer:', marginLeft, fy + 13);
  doc.text('HRB 208111', marginLeft + 25, fy + 13);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Gewerbeerlaubnis nach § 34 C GewO; Aufsichtsbehörde:', marginLeft, fy + 18);
  doc.setFont('helvetica', 'normal');
  doc.text('IHK Hannover', marginLeft, fy + 21);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Steuer-Nummer:', marginLeft, fy + 25);
  doc.setFont('helvetica', 'normal');
  doc.text('16/204/50884', marginLeft + 22, fy + 25);
  
  // Right column
  const rightCol = 130;
  doc.setFont('helvetica', 'bold');
  doc.text('Mitglied in:', rightCol, fy);
  doc.setFont('helvetica', 'normal');
  doc.text('IHK Industrie- und Handelskammer', rightCol, fy + 3);
  doc.text('Creditreform', rightCol, fy + 6);
  
  // NiImmo logo in footer (small)
  if (logo) {
    doc.addImage(logo, 'PNG', 85, footerY + 10, 30, 18);
  }
  
  return doc.output('blob');
}

function formatEuro(betrag: number): string {
  return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
