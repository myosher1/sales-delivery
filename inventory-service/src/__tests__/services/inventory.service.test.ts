import { jest } from '@jest/globals';

// Define types for better mock typing
type MockProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  isActive: number;
};

// Create a more comprehensive mock that matches the actual db structure
const mockFindFirst = jest.fn() as jest.MockedFunction<(options?: any) => Promise<MockProduct | null>>;

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  execute: jest.fn() as jest.MockedFunction<() => Promise<any>>,
  query: {
    products: {
      findFirst: mockFindFirst
    }
  }
};

// Mock the database connection before importing - use await for proper ES module handling
await jest.unstable_mockModule('../../db/connection.js', () => ({
  db: mockDb
}));

// Import the service dynamically
const inventoryServiceModule = await import('../../services/inventory.service.js');
const inventoryService = inventoryServiceModule.inventoryService;

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the specific mock we care about
    mockFindFirst.mockReset();
  });

  describe('checkAvailability', () => {
    const mockItems = [
      { productId: 'prod-001', quantity: 2 },
      { productId: 'prod-002', quantity: 1 }
    ];

    it('should return available for products with sufficient stock', async () => {
      // Debug: Let's see if our mock is being called
      console.log('Setting up mock for sufficient stock test');
      
      mockFindFirst
        .mockResolvedValueOnce({
          id: 'prod-001',
          name: 'Product 1',
          stockQuantity: 10,
          isActive: 1
        })
        .mockResolvedValueOnce({
          id: 'prod-002',
          name: 'Product 2',
          stockQuantity: 5,
          isActive: 1
        });

      const result = await inventoryService.checkAvailability(mockItems);

      // Debug: Check if mock was called
      console.log('Mock call count:', mockFindFirst.mock.calls.length);
      console.log('Result:', result);

      expect(mockFindFirst).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 'prod-001',
        productName: 'Product 1',
        requested: 2,
        currentStock: 10,
        available: true
      });
      expect(result[1]).toEqual({
        productId: 'prod-002',
        productName: 'Product 2',
        requested: 1,
        currentStock: 5,
        available: true
      });
    });

    it('should return unavailable for non-existent products', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await inventoryService.checkAvailability([
        { productId: 'non-existent', quantity: 1 }
      ]);

      expect(mockFindFirst).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productId: 'non-existent',
        available: false,
        reason: 'Product not found'
      });
    });

    it('should return unavailable for inactive products', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'prod-001',
        name: 'Inactive Product',
        stockQuantity: 10,
        isActive: 0
      });

      const result = await inventoryService.checkAvailability([
        { productId: 'prod-001', quantity: 1 }
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productId: 'prod-001',
        productName: 'Inactive Product',
        available: false,
        reason: 'Product is not active'
      });
    });

    it('should return unavailable for insufficient stock', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'prod-001',
        name: 'Low Stock Product',
        stockQuantity: 1,
        isActive: 1
      });

      const result = await inventoryService.checkAvailability([
        { productId: 'prod-001', quantity: 5 }
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productId: 'prod-001',
        productName: 'Low Stock Product',
        requested: 5,
        currentStock: 1,
        available: false,
        reason: 'Insufficient stock'
      });
    });
  });

  describe('reserveStock', () => {
    const mockItems = [
      { productId: 'prod-001', quantity: 2 }
    ];

    it('should successfully reserve stock', async () => {
      const mockProduct = {
        id: 'prod-001',
        name: 'Product 1',
        stockQuantity: 10,
        isActive: 1
      };

      mockFindFirst.mockResolvedValue(mockProduct);
      mockDb.execute
        .mockResolvedValueOnce(undefined) // Stock update
        .mockResolvedValueOnce(undefined); // Movement log

      const result = await inventoryService.reserveStock('order-123', mockItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productId: 'prod-001',
        quantityReserved: 2,
        previousStock: 10,
        newStock: 8
      });
    });

    it('should throw error for insufficient stock during reservation', async () => {
      const mockProduct = {
        id: 'prod-001',
        name: 'Product 1',
        stockQuantity: 1,
        isActive: 1
      };

      mockFindFirst.mockResolvedValue(mockProduct);

      await expect(
        inventoryService.reserveStock('order-123', [
          { productId: 'prod-001', quantity: 5 }
        ])
      ).rejects.toThrow('Cannot reserve stock for product prod-001: insufficient stock');
    });

    it('should throw error for non-existent product during reservation', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(
        inventoryService.reserveStock('order-123', mockItems)
      ).rejects.toThrow('Cannot reserve stock for product prod-001: insufficient stock');
    });
  });

  describe('releaseStock', () => {
    const mockItems = [
      { productId: 'prod-001', quantity: 2 }
    ];

    it('should successfully release stock', async () => {
      const mockProduct = {
        id: 'prod-001',
        name: 'Product 1',
        stockQuantity: 8,
        isActive: 1
      };

      mockFindFirst.mockResolvedValue(mockProduct);
      mockDb.execute
        .mockResolvedValueOnce(undefined) // Stock update
        .mockResolvedValueOnce(undefined); // Movement log

      const result = await inventoryService.releaseStock('order-123', mockItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productId: 'prod-001',
        quantityReleased: 2,
        previousStock: 8,
        newStock: 10
      });
    });

    it('should throw error for non-existent product during release', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(
        inventoryService.releaseStock('order-123', mockItems)
      ).rejects.toThrow('Cannot release stock for product prod-001: product not found');
    });
  });
});
