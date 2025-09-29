interface OCRProcessingResult {
  success: boolean;
  extractedData?: {
    kaltmiete?: number;
    betriebskosten?: number;
    kaution_betrag?: number;
    start_datum?: string;
    ende_datum?: string;
    mieter_vorname?: string;
    mieter_nachname?: string;
    verwendungszweck?: string;
  };
  error?: string;
  confidence?: 'high' | 'medium' | 'low';
  fieldsExtracted?: number;
}

export class OCRProcessingService {
  static async processContractDocument(file: File): Promise<OCRProcessingResult> {
    try {
      console.log('Starting OCR processing for:', file.name);

      let textContent = '';
      let base64 = '';

      // Handle PDF files by extracting text
      if (file.type === 'application/pdf') {
        textContent = await this.extractTextFromPDF(file);
        console.log('Extracted text from PDF:', textContent.length, 'characters');
      } else {
        // Convert non-PDF files to base64 for image processing
        base64 = await this.fileToBase64(file);
      }

      // If PDF has no text, render first page as image and continue with OCR backend
      if (file.type === 'application/pdf' && (!textContent || textContent.trim().length < 30)) {
        console.warn('PDF enthält keinen verwertbaren Text. Rendere erste Seite als Bild für OCR.');
        base64 = await this.renderPdfFirstPageToPngBase64(file);
        if (!base64) {
          return { success: false, error: 'PDF konnte nicht für OCR vorbereitet werden. Bitte lade ein klares Bild (JPG/PNG) oder ein textbasiertes PDF hoch.' };
        }
      }

      // Prepare fileType based on whether we rendered an image fallback
      const effectiveFileType = (file.type === 'application/pdf' && (!textContent || textContent.trim().length < 30)) ? 'image/png' : file.type;

      // Invoke Supabase Edge Function (für Bild-OCR oder wenn Text vorhanden ist)
      const { data, error } = await (await import('@/integrations/supabase/client'))
        .supabase.functions.invoke('process-contract-ocr', {
          body: {
            fileName: file.name,
            fileType: effectiveFileType,
            fileSize: file.size,
            fileContent: base64,
            textContent: textContent,
          },
        });

      if (error) {
        throw new Error(error.message || 'OCR processing failed');
      }

      console.log('OCR processing result:', data);
      return (data as OCRProcessingResult) ?? { success: false, error: 'Leere Antwort vom Server' };
    } catch (error: any) {
      console.error('OCR Processing Error:', error);
      return {
        success: false,
        error: error.message || 'OCR processing failed',
      };
    }
  }

  private static async extractTextFromPDF(file: File): Promise<string> {
    try {
      // Dynamically import PDF.js (prefer legacy build for better bundler compatibility)
      let pdfjsLib: any;
      try {
        pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
      } catch (e) {
        console.warn('Falling back to non-legacy pdfjs-dist build:', e);
        pdfjsLib = await import('pdfjs-dist/build/pdf');
      }
      
      // Set up worker using bundled version
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.js',
          import.meta.url
        ).toString();
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extract text from each page (limit to first 5 pages for performance)
      const numPages = Math.min(pdf.numPages, 5);
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n\nSeite ${i}:\n${pageText}`;
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return '';

    }
  }

  private static async renderPdfFirstPageToPngBase64(file: File): Promise<string> {
    try {
      let pdfjsLib: any;
      try {
        pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
      } catch (_) {
        pdfjsLib = await import('pdfjs-dist/build/pdf');
      }
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.js',
          import.meta.url
        ).toString();
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) return '';
      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
    } catch (e) {
      console.error('PDF first page render failed:', e);
      return '';
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove any data:*;base64, prefix if present
        const commaIdx = result.indexOf(',');
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  /**
   * Validate extracted contract data for reasonableness
   */
  static validateExtractedData(data: any): boolean {
    // Basic validation rules
    if (data.kaltmiete) {
      const rent = parseFloat(data.kaltmiete);
      if (rent < 100 || rent > 10000) return false; // Reasonable rent range
    }

    if (data.kaution_betrag) {
      const deposit = parseFloat(data.kaution_betrag);
      if (deposit < 0 || deposit > 50000) return false; // Reasonable deposit range
    }

    if (data.start_datum) {
      const startDate = new Date(data.start_datum);
      const now = new Date();
      const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      const twoYearsForward = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

      if (startDate < fiveYearsAgo || startDate > twoYearsForward) return false;
    }

    return true;
  }

  /**
   * Format extracted data for form fields
   */
  static formatDataForForm(data: any) {
    const formatted: any = {};

    if (data.kaltmiete) formatted.kaltmiete = data.kaltmiete.toString();
    if (data.betriebskosten) formatted.betriebskosten = data.betriebskosten.toString();
    if (data.kaution_betrag) formatted.kaution_betrag = data.kaution_betrag.toString();
    if (data.start_datum) formatted.start_datum = data.start_datum;
    if (data.ende_datum) formatted.ende_datum = data.ende_datum;
    if (data.verwendungszweck) formatted.verwendungszweck = data.verwendungszweck;

    return formatted;
  }
}