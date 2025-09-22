interface TerminationNotificationData {
  vertragId: string;
  kuendigungsdatum: string;
  grund?: string;
  bemerkungen?: string;
  documentPath?: string;
  fileName?: string;
  method: 'manual' | 'document_upload';
}

class TerminationWebhookService {
  private readonly webhookEndpoints = [
    // Add your webhook URLs here
    // 'https://your-webhook-endpoint.com/termination'
  ];

  async notifyTermination(data: TerminationNotificationData): Promise<void> {
    const payload = {
      event: 'contract_terminated',
      timestamp: new Date().toISOString(),
      data: {
        contractId: data.vertragId,
        terminationDate: data.kuendigungsdatum,
        reason: data.grund,
        notes: data.bemerkungen,
        documentPath: data.documentPath,
        fileName: data.fileName,
        method: data.method,
      }
    };

    // If no webhooks are configured, just log the event
    if (this.webhookEndpoints.length === 0) {
      console.log('Termination event (no webhooks configured):', payload);
      return;
    }

    // Send to all configured webhook endpoints
    const promises = this.webhookEndpoints.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

        console.log(`Webhook notification sent successfully to ${url}`);
      } catch (error) {
        console.error(`Failed to send webhook to ${url}:`, error);
        throw error;
      }
    });

    // Wait for all webhook calls to complete (or fail)
    await Promise.allSettled(promises);
  }

  // Method to call the existing tenant service if needed
  async kuendigungMieter(vertragId: string, kuendigungsdatum: string): Promise<void> {
    try {
      // This would integrate with your existing tenant service
      // Placeholder for actual implementation
      console.log(`Calling tenant service for contract ${vertragId} with termination date ${kuendigungsdatum}`);
      
      // Example of what this might look like:
      // await tenantService.terminateContract(vertragId, kuendigungsdatum);
    } catch (error) {
      console.error('Error calling tenant service:', error);
      throw error;
    }
  }
}

export const terminationWebhookService = new TerminationWebhookService();