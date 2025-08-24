import { jest } from '@jest/globals';
import type { Delivery } from '../../db/schema.js';

// Mock delivery service BEFORE importing anything else
const mockDeliveryService = {
    listDeliveries: jest.fn() as jest.MockedFunction<() => Promise<any[]>>,
    getDeliveryById: jest.fn() as jest.MockedFunction<(id: number) => Promise<any>>,
    updateDeliveryStatus: jest.fn() as jest.MockedFunction<(id: number, status: string, fastify?: any) => Promise<any>>,
    createDelivery: jest.fn() as jest.MockedFunction<(data: any, fastify?: any) => Promise<any>>
};

// Mock the module before importing
await jest.unstable_mockModule('../../services/delivery.service.js', () => ({
    deliveryService: mockDeliveryService
}));

// Now import the modules that depend on the mocked service
const { default: Fastify } = await import('fastify');
const { deliveryRoutes } = await import('../../routes/delivery.js');
const schema = await import('../../db/schema.js');

describe('Delivery Routes', () => {
    let app: any;

    beforeEach(async () => {
        app = Fastify();
        await app.register(deliveryRoutes);
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('GET /deliveries', () => {
        it('should return list of deliveries', async () => {
            const mockDeliveries: Delivery[] = [
                {
                    id: 1,
                    orderId: 'order-123',
                    customerId: 'customer-123',
                    address: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        zipCode: '12345',
                        email: 'test@example.com'
                    },
                    status: 'PENDING',
                    estimatedDelivery: null,
                    deliveredAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 2,
                    orderId: 'order-456',
                    customerId: 'customer-456',
                    address: {
                        street: '456 Test Ave',
                        city: 'Test City',
                        state: 'TS',
                        zipCode: '67890',
                        email: 'test2@example.com'
                    },
                    status: 'IN_TRANSIT',
                    estimatedDelivery: null,
                    deliveredAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            mockDeliveryService.listDeliveries.mockResolvedValue(mockDeliveries);

            const response = await app.inject({
                method: 'GET',
                url: '/deliveries'
            });

            expect(response.statusCode).toBe(200);
            const responseData = JSON.parse(response.payload);
            expect(responseData).toHaveLength(2);
            expect(responseData[0].orderId).toBe('order-123');
            expect(responseData[1].status).toBe('IN_TRANSIT');
        });

        it('should handle service errors', async () => {
            (mockDeliveryService.listDeliveries as any).mockRejectedValue(new Error('Database error'));

            const response = await app.inject({
                method: 'GET',
                url: '/deliveries'
            });

            expect(response.statusCode).toBe(500);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toBe('Failed to fetch deliveries');
        });
    });

    describe('GET /deliveries/:id', () => {
        it('should return delivery by ID', async () => {
            const mockDelivery = {
                id: 1,
                orderId: 'order-123',
                customerId: 'customer-123',
                address: {
                    street: '123 Test St',
                    city: 'Test City',
                    state: 'TS',
                    zipCode: '12345',
                    email: 'test@example.com'
                },
                status: 'PENDING',
                estimatedDelivery: null,
                deliveredAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockDeliveryService.getDeliveryById.mockResolvedValue(mockDelivery);

            const response = await app.inject({
                method: 'GET',
                url: '/deliveries/1'
            });

            expect(response.statusCode).toBe(200);
            const responseData = JSON.parse(response.payload);
            expect(responseData.id).toBe(1);
            expect(responseData.orderId).toBe('order-123');
            expect(mockDeliveryService.getDeliveryById).toHaveBeenCalledWith(1);
        });

        it('should return 404 when delivery not found', async () => {
            mockDeliveryService.getDeliveryById.mockResolvedValue(null);

            const response = await app.inject({
                method: 'GET',
                url: '/deliveries/999'
            });

            expect(response.statusCode).toBe(404);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toBe('Delivery not found');
        });

        it('should handle invalid ID parameter', async () => {
            mockDeliveryService.getDeliveryById.mockRejectedValue(new Error('Invalid ID'));

            const response = await app.inject({
                method: 'GET',
                url: '/deliveries/invalid'
            });

            expect(response.statusCode).toBe(500);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toBe('Failed to fetch delivery');
        });
    });

    describe('PATCH /deliveries/:id/status', () => {
        it('should update delivery status successfully', async () => {
            const mockUpdatedDelivery = {
                id: 1,
                orderId: 'order-123',
                status: 'IN_TRANSIT'
            };

            mockDeliveryService.updateDeliveryStatus.mockResolvedValue(mockUpdatedDelivery);

            const response = await app.inject({
                method: 'PATCH',
                url: '/deliveries/1/status',
                payload: {status: 'IN_TRANSIT'}
            });

            expect(response.statusCode).toBe(200);
            const responseData = JSON.parse(response.payload);
            expect(responseData.deliveryId).toBe(1);
            expect(responseData.orderId).toBe('order-123');
            expect(responseData.status).toBe('IN_TRANSIT');
            expect(responseData.message).toContain('IN_TRANSIT');
        });

        it('should validate status values', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/deliveries/1/status',
                payload: {status: 'INVALID_STATUS'}
            });

            expect(response.statusCode).toBe(400);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toContain('Invalid status');
        });

        it('should return 404 when delivery not found for status update', async () => {
            mockDeliveryService.updateDeliveryStatus.mockResolvedValue(null);

            const response = await app.inject({
                method: 'PATCH',
                url: '/deliveries/999/status',
                payload: {status: 'IN_TRANSIT'}
            });

            expect(response.statusCode).toBe(404);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toBe('Delivery not found');
        });

        it('should handle all valid status transitions', async () => {
            const validStatuses = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'];

            for (const status of validStatuses) {
                const mockUpdatedDelivery = {
                    id: 1,
                    orderId: 'order-123',
                    status
                };

                mockDeliveryService.updateDeliveryStatus.mockResolvedValue(mockUpdatedDelivery);

                const response = await app.inject({
                    method: 'PATCH',
                    url: '/deliveries/1/status',
                    payload: {status}
                });

                expect(response.statusCode).toBe(200);
                const responseData = JSON.parse(response.payload);
                expect(responseData.status).toBe(status);
            }
        });

        it('should handle service errors during status update', async () => {
            mockDeliveryService.updateDeliveryStatus.mockRejectedValue(new Error('Database error'));

            const response = await app.inject({
                method: 'PATCH',
                url: '/deliveries/1/status',
                payload: {status: 'IN_TRANSIT'}
            });

            expect(response.statusCode).toBe(500);
            const responseData = JSON.parse(response.payload);
            expect(responseData.error).toBe('Failed to update delivery status');
        });
    });
});
