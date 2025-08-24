import { jest } from '@jest/globals';
import Fastify from 'fastify';

// Type the mock objects properly
const mockDb = {
  insert: jest.fn() as jest.MockedFunction<any>,
  query: {
    orders: {
      findFirst: jest.fn() as jest.MockedFunction<any>
    }
  },
  update: jest.fn() as jest.MockedFunction<any>
};

// Create helper functions for complex mock chains with explicit typing
const createInsertMock = (returnValue: any) => ({
  values: (jest.fn() as jest.MockedFunction<any>).mockReturnValue({
    returning: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(returnValue)
  })
});

const createUpdateMock = (returnValue: any) => ({
  set: (jest.fn() as jest.MockedFunction<any>).mockReturnValue({
    where: (jest.fn() as jest.MockedFunction<any>).mockReturnValue({
      returning: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(returnValue)
    })
  })
});

const mockInventoryClient = {
  checkAvailability: jest.fn() as jest.MockedFunction<any>
};

const mockRabbitMQ = {
  reserveStock: jest.fn() as jest.MockedFunction<any>,
  publishOrderEvent: jest.fn() as jest.MockedFunction<any>
};

// Mock modules before importing
await jest.unstable_mockModule('../../db/connection.js', () => ({
  db: mockDb
}));

await jest.unstable_mockModule('../../services/inventory.client.js', () => ({
  inventoryClient: mockInventoryClient
}));

await jest.unstable_mockModule('../../plugins/rabbitmq.js', () => ({}));

// Import the route after mocking
const { ordersRoute } = await import('../../routes/orders.js');

describe('Orders Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();

    // Mock RabbitMQ plugin
    app.decorate('rabbitmq', mockRabbitMQ);

    await app.register(ordersRoute);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    const validOrderData = {
      customerId: 'customer-123',
      customerEmail: 'test@example.com',
      shippingAddress: '123 Test St',
      items: [
        {
          productId: 'prod-001',
          productName: 'Test Product',
          quantity: 2,
          unitPrice: 99.99
        }
      ]
    };

    it('should create a new order successfully', async () => {
      // Mock inventory check success
      mockInventoryClient.checkAvailability.mockResolvedValue({
        available: true,
        items: [{ productId: 'prod-001', available: true }]
      });

      // Mock database operations
      mockDb.insert.mockReturnValue(createInsertMock([{
        id: 'order-123',
        status: 'Pending Shipment',
        totalAmount: '199.98'
      }]));

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: validOrderData
      });

      expect(response.statusCode).toBe(201);
      const responseData = JSON.parse(response.payload);
      expect(responseData.orderId).toBe('order-123');
      expect(responseData.status).toBe('Pending Shipment');
      expect(responseData.totalAmount).toBe('199.98');
    });

    it('should reject order when inventory is not available', async () => {
      // Mock inventory check failure
      mockInventoryClient.checkAvailability.mockResolvedValue({
        available: false,
        unavailableItems: [{ productId: 'prod-001', reason: 'Out of stock' }]
      });

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: validOrderData
      });

      expect(response.statusCode).toBe(400);
      const responseData = JSON.parse(response.payload);
      expect(responseData.error).toContain('product availability issues');
    });

    it('should handle inventory service timeout', async () => {
      // Mock inventory service timeout
      mockInventoryClient.checkAvailability.mockRejectedValue(
        new Error('Request timeout')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: validOrderData
      });

      expect(response.statusCode).toBe(500);
      const responseData = JSON.parse(response.payload);
      expect(responseData.error).toBe('Failed to create order');
    });

    it('should validate required fields', async () => {
      const invalidOrderData = {
        customerId: 'customer-123',
        // Missing required fields
      };

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: invalidOrderData
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /orders/:orderId', () => {
    it('should return order details when order exists', async () => {
      const mockOrder = {
        id: 'order-123',
        customerId: 'customer-123',
        customerEmail: 'test@example.com',
        status: 'Pending Shipment',
        totalAmount: '199.98',
        createdAt: new Date(),
        updatedAt: new Date(),
        orderItems: [
          {
            id: 'item-1',
            productId: 'prod-001',
            productName: 'Test Product',
            quantity: 2,
            unitPrice: '99.99',
            totalPrice: '199.98'
          }
        ]
      };

      mockDb.query.orders.findFirst.mockResolvedValue(mockOrder);

      const response = await app.inject({
        method: 'GET',
        url: '/orders/order-123'
      });

      expect(response.statusCode).toBe(200);
      const responseData = JSON.parse(response.payload);
      expect(responseData.id).toBe('order-123');
      expect(responseData.items).toHaveLength(1);
    });

    it('should return 404 when order does not exist', async () => {
      mockDb.query.orders.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/orders/nonexistent-order'
      });

      expect(response.statusCode).toBe(404);
      const responseData = JSON.parse(response.payload);
      expect(responseData.error).toBe('Order not found');
    });
  });

  describe('PATCH /orders/:orderId/status', () => {
    it('should update order status successfully', async () => {
      const mockUpdatedOrder = {
        id: 'order-123',
        status: 'Shipped'
      };

      mockDb.update.mockReturnValue(createUpdateMock([mockUpdatedOrder]));

      const response = await app.inject({
        method: 'PATCH',
        url: '/orders/order-123/status',
        payload: { status: 'Shipped' }
      });

      expect(response.statusCode).toBe(200);
      const responseData = JSON.parse(response.payload);
      expect(responseData.orderId).toBe('order-123');
      expect(responseData.status).toBe('Shipped');
    });

    it('should return 404 when order does not exist', async () => {
      mockDb.update.mockReturnValue(createUpdateMock([]));

      const response = await app.inject({
        method: 'PATCH',
        url: '/orders/nonexistent-order/status',
        payload: { status: 'Shipped' }
      });

      expect(response.statusCode).toBe(404);
      const responseData = JSON.parse(response.payload);
      expect(responseData.error).toBe('Order not found');
    });
  });
});
