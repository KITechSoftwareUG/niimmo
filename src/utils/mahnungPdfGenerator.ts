import { jsPDF } from 'jspdf';

export interface MahnungPdfData {
  // Empfänger
  anrede: string;
  mieterName: string;
  mieterNachname: string;
  mieterAdresse: string;
  mieterPlzOrt: string;
  
  // Vertrag
  einheitBezeichnung: string;
  immobilieAdresse: string;
  vertragStart: string;
  
  // Mahnung
  mahnstufe: number;
  datum: string;
  
  // Forderungen
  offeneForderungen: Array<{
    monat: string;
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
  const maxY = 250; // page break threshold (leave room for footer)
  
  const logo = await loadLogo();

  // Helper: check if we need a page break and add one if so
  function checkPageBreak(currentY: number, neededSpace: number = 15): number {
    if (currentY + neededSpace > maxY) {
      addFooter(doc, logo);
      doc.addPage();
      addHeader(doc, logo, marginLeft, marginRight, pageWidth);
      return 58; // resume Y after header on new page
    }
    return currentY;
  }

  // ============ PAGE 1 HEADER ============
  addHeader(doc, logo, marginLeft, marginRight, pageWidth);
  
  // ============ SENDER LINE ============
  let y = 55;
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
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
  doc.text('Tel.    05138 – 600 72 72', contactX, contactY);
  contactY += 4;
  doc.text('Fax    05138 – 600 72 79', contactX, contactY);
  contactY += 4;
  doc.text('          Egestorffstraße 11, 31319 Sehnde', contactX, contactY);
  contactY += 4;
  doc.text('Mail   mikyas@niimmo.de', contactX, contactY);
  
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
  
  const lineHeight = 5;
  
  if (data.freitext) {
    const lines = doc.splitTextToSize(data.freitext, contentWidth);
    for (const line of lines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
  } else {
    let bodyText: string;
    
    if (data.mahnstufe >= 3) {
      bodyText = `Sie haben seit Beginn des Mietverhältnisses am ${data.vertragStart} Ihre Mietzahlungen wiederholt verspätet und unregelmäßig erbracht. Trotz meiner Mahnung sind die Mietrückstände nicht ausgeglichen worden.\n\nDer Mietrückstand beläuft sich inzwischen auf ${data.anzahlMonatsmieten} Monatsmieten in Höhe von insgesamt ${formatEuro(data.gesamtRueckstand)} €. Damit befinden Sie sich im erheblichen Zahlungsverzug im Sinne der §§ 543 Abs. 2 Nr. 3, 569 Abs. 3 Nr. 1 BGB.`;
    } else if (data.mahnstufe === 2) {
      bodyText = `trotz unserer ersten Mahnung sind die folgenden Zahlungen weiterhin nicht bei uns eingegangen. Wir fordern Sie hiermit erneut zur Zahlung auf.\n\nDer Mietrückstand beläuft sich auf insgesamt ${formatEuro(data.gesamtRueckstand)} €.`;
    } else {
      bodyText = `wir möchten Sie darauf hinweisen, dass folgende Mietzahlungen noch nicht bei uns eingegangen sind:\n\nDer Mietrückstand beläuft sich auf insgesamt ${formatEuro(data.gesamtRueckstand)} €.`;
    }
    
    const paragraphs = bodyText.split('\n\n');
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        y += 3;
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, contentWidth);
      for (const line of lines) {
        y = checkPageBreak(y, lineHeight);
        doc.text(line, marginLeft, y);
        y += lineHeight;
      }
      y += 3;
    }
    y += 2;
  }
  
  // ============ VERZUGSZINSEN ============
  if (data.verzugszinsenDetails.length > 0) {
    y = checkPageBreak(y, 20);
    y += 2;
    const zinsenIntro = doc.splitTextToSize(
      'Zusätzlich schulden Sie für die nicht bzw. verspätet gezahlten Mieten Verzugszinsen nach § 288 BGB. Bis zum heutigen Tage belaufen sich diese auf:',
      contentWidth
    );
    for (const line of zinsenIntro) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 3;
    
    for (const detail of data.verzugszinsenDetails) {
      y = checkPageBreak(y, lineHeight);
      const line = detail.laufend
        ? `${detail.monat}: ab ${data.datum} weiter laufend`
        : `${detail.monat}: ${formatEuro(detail.betrag)} €`;
      doc.text(line, marginLeft + 5, y);
      y += lineHeight;
    }
    
    y += 2;
    y = checkPageBreak(y, lineHeight);
    const zwischenText = `Zwischensumme Verzugszinsen: ${formatEuro(data.verzugszinsenGesamt)} € (zuzüglich weiterer Zinsen bis zur vollständigen Zahlung).`;
    const zwischenLines = doc.splitTextToSize(zwischenText, contentWidth);
    for (const line of zwischenLines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
  }
  
  // Mahnkosten
  if (data.mahnkostenGesamt > 0) {
    y = checkPageBreak(y, lineHeight + 4);
    const mahnkostenText = `Weiterhin entstehen Mahnkosten i. H. v. ${formatEuro(data.mahnkostenProSchreiben)} € pro Mahnschreiben, somit ${formatEuro(data.mahnkostenGesamt)} €.`;
    const mahnkostenLines = doc.splitTextToSize(mahnkostenText, contentWidth);
    for (const line of mahnkostenLines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
  }
  
  // ============ KÜNDIGUNG (Stufe 3) ============
  if (data.mahnstufe >= 3) {
    y = checkPageBreak(y, 30);
    const kuendigungText = `Hiermit kündige ich daher das bestehende Mietverhältnis über die Wohnung in der ${data.immobilieAdresse}, ${data.einheitBezeichnung} außerordentlich fristlos. Wir fordern Sie auf die Wohnung unverzüglich, spätestens jedoch bis zum ${data.raeumungsfristDatum || data.zahlungsfristDatum} zu räumen.`;
    const kuendigungLines = doc.splitTextToSize(kuendigungText, contentWidth);
    for (const line of kuendigungLines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
    
    y = checkPageBreak(y, 25);
    const fristText = `Unabhängig hiervon setze ich Ihnen – ohne Anerkennung einer Rechtspflicht – eine Frist von 7 Kalendertagen, spätestens bis zum ${data.zahlungsfristDatum}, um sämtliche Mietrückstände nebst Zinsen vollständig auszugleichen. Sollten Sie die Rückstände nicht innerhalb dieser Frist begleichen, werde ich die fristlose Kündigung vollumfänglich durchsetzen und Räumungsklage erheben.`;
    const fristLines = doc.splitTextToSize(fristText, contentWidth);
    for (const line of fristLines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
  } else {
    y = checkPageBreak(y, 15);
    const zahlungsText = `Wir bitten Sie, den Gesamtbetrag bis zum ${data.zahlungsfristDatum} auf unser Konto zu überweisen.`;
    const zahlungsLines = doc.splitTextToSize(zahlungsText, contentWidth);
    for (const line of zahlungsLines) {
      y = checkPageBreak(y, lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
    
    if (data.mahnstufe === 2) {
      y = checkPageBreak(y, lineHeight + 4);
      doc.text('Bei ausbleibender Zahlung behalten wir uns rechtliche Schritte vor.', marginLeft, y);
      y += lineHeight + 4;
    }
  }
  
  // Contact closing
  y = checkPageBreak(y, lineHeight + 8);
  const closingText = 'Für Rückfragen stehen wir Ihnen gerne unter den oben genannten Kontaktdaten zur Verfügung.';
  const closingLines = doc.splitTextToSize(closingText, contentWidth);
  for (const line of closingLines) {
    y = checkPageBreak(y, lineHeight);
    doc.text(line, marginLeft, y);
    y += lineHeight;
  }
  y += 8;
  
  // ============ SIGNATURE ============
  y = checkPageBreak(y, 25);
  doc.text('Mit freundlichem Gruß', marginLeft, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.text('Denis Mikyas', marginLeft, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Geschäftsführer', marginLeft, y);
  
  // ============ FOOTER (last page) ============
  addFooter(doc, logo);
  
  return doc.output('blob');
}

function addHeader(doc: jsPDF, logo: string | null, marginLeft: number, marginRight: number, pageWidth: number) {
  if (logo) {
    doc.addImage(logo, 'PNG', 75, 8, 60, 35);
  }
  // Red separator line
  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, 48, pageWidth - marginRight, 48);
}

function addFooter(doc: jsPDF, logo: string | null) {
  const marginLeft = 25;
  const pageWidth = 210;
  const marginRight = 25;
  const footerY = 255;
  
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY);
  
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
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
  
  if (logo) {
    doc.addImage(logo, 'PNG', 85, footerY + 10, 30, 18);
  }
}

function formatEuro(betrag: number): string {
  return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
