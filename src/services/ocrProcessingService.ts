interface OCRProcessingResult {
  success: boolean;
  extractedData?: {
    kaltmiete?: string;
    betriebskosten?: string;
    kaution_betrag?: string;
    start_datum?: string;
    ende_datum?: string;
    mieter_name?: string;
    mieter_vorname?: string;
  };
  error?: string;
}

export class OCRProcessingService {
  private static WEBHOOK_URL = 'https://your-n8n-instance.com/webhook/ocr-contract'; // Replace with actual n8n webhook URL

  static async processContractDocument(file: File): Promise<OCRProcessingResult> {
    try {
      // Convert file to base64 for API transmission
      const base64 = await this.fileToBase64(file);
      
      const response = await fetch(this.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileContent: base64,
          timestamp: new Date().toISOString(),
          source: 'lovable-rental-management'
        })
      });

      if (!response.ok) {
        throw new Error(`OCR processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        extractedData: result.extractedData || {}
      };

    } catch (error: any) {
      console.error('OCR Processing Error:', error);
      return {
        success: false,
        error: error.message || 'OCR processing failed'
      };
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
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
}