interface InventoryItem {
  productId: string;
  quantity: number;
}

interface InventoryCheckResponse {
  available: boolean;
  items: Array<{
    productId: string;
    available: boolean;
    requestedQuantity: number;
    availableQuantity: number;
    reason?: string;
  }>;
  unavailableItems?: Array<{
    productId: string;
    available: boolean;
    requestedQuantity: number;
    availableQuantity: number;
    reason?: string;
  }>;
}

export class InventoryClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3003';
  }

  async checkAvailability(items: InventoryItem[]): Promise<InventoryCheckResponse> {
    try {
      console.log(`[InventoryClient] Making HTTP request to ${this.baseUrl}/check-availability`);
      console.log(`[InventoryClient] Request payload:`, { items });
      
      const response = await fetch(`${this.baseUrl}/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      console.log(`[InventoryClient] HTTP response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.error(`[InventoryClient] HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`[InventoryClient] Response received:`, {
        available: result.available,
        itemCount: result.items?.length || 0,
        unavailableCount: result.unavailableItems?.length || 0,
        fullResponse: result
      });
      
      return result;
    } catch (error: any) {
      console.error('[InventoryClient] Error checking inventory availability:', error);
      throw new Error(`Failed to check inventory: ${error.message}`);
    }
  }
}

export const inventoryClient = new InventoryClient();
