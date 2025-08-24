import { jest } from '@jest/globals';

// Mock the global fetch function
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Import the service after mocking
const { InventoryClient } = await import('../../services/inventory.client.js');

describe('InventoryClient', () => {
  let inventoryClient: InstanceType<typeof InventoryClient>;

  beforeEach(() => {
    inventoryClient = new InventoryClient();
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('checkAvailability', () => {
    const mockItems = [
      { productId: 'prod-001', quantity: 2 },
      { productId: 'prod-002', quantity: 1 }
    ];

    it('should successfully check inventory availability', async () => {
      const mockResponse = {
        available: true,
        items: [
          { productId: 'prod-001', available: true, currentStock: 10 },
          { productId: 'prod-002', available: true, currentStock: 5 }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(mockResponse)
      } as unknown as Response);

      const result = await inventoryClient.checkAvailability(mockItems);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://inventory-service:3003/check-availability',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: mockItems }),
        }
      );

      expect(result).toEqual(mockResponse);
      expect(result.available).toBe(true);
      expect(result.items).toHaveLength(2);
    });

    it('should handle inventory unavailability', async () => {
      const mockResponse = {
        available: false,
        items: [
          { productId: 'prod-001', available: false, reason: 'Out of stock' }
        ],
        unavailableItems: [
          { productId: 'prod-001', reason: 'Out of stock' }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(mockResponse)
      } as unknown as Response);

      const result = await inventoryClient.checkAvailability(mockItems);

      expect(result.available).toBe(false);
      expect(result.unavailableItems).toHaveLength(1);
      expect(result.unavailableItems?.[0]?.reason).toBe('Out of stock');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as Response);

      await expect(inventoryClient.checkAvailability(mockItems))
        .rejects
        .toThrow('Failed to check inventory: HTTP error! status: 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(inventoryClient.checkAvailability(mockItems))
        .rejects
        .toThrow('Failed to check inventory: Network error');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: (jest.fn() as jest.MockedFunction<any>).mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as Response);

      await expect(inventoryClient.checkAvailability(mockItems))
        .rejects
        .toThrow('Failed to check inventory: Invalid JSON');
    });

    it('should use custom base URL from environment', () => {
      process.env.INVENTORY_SERVICE_URL = 'http://custom-inventory:3003';
      const customClient = new InventoryClient();

      expect((customClient as any).baseUrl).toBe('http://custom-inventory:3003');

      // Clean up
      delete process.env.INVENTORY_SERVICE_URL;
    });
  });
});
