import { jest } from '@jest/globals';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { idempotencyPreHandler } from '../../middleware/idempotency.js';

// Mock Redis with proper typing
const mockRedis = {
  get: jest.fn<() => Promise<string | null>>(),
  setex: jest.fn<() => Promise<string>>(),
  ping: jest.fn<() => Promise<string>>()
};

describe('Idempotency Middleware', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();

    // Mock Redis client
    app.decorate('redis', mockRedis);

    // Add a test route with idempotency middleware
    app.post('/test', { preHandler: idempotencyPreHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
      return { message: 'success', timestamp: Date.now() };
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('idempotencyPreHandler', () => {
    it('should process request normally when no idempotency key is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { data: 'test' }
      });

      expect(response.statusCode).toBe(200);
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should process request normally when idempotency key is new', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'test-key-123'
        },
        payload: { data: 'test' }
      });

      expect(response.statusCode).toBe(200);
      expect(mockRedis.get).toHaveBeenCalledWith('idempotency:test-key-123');

      // Should cache the response
      expect(mockRedis.setex).toHaveBeenCalled();
      const setexCall = mockRedis.setex.mock.calls[0] as unknown as [string, number, string];
      expect(setexCall[0]).toBe('idempotency:test-key-123');
      expect(setexCall[1]).toBe(3600); // 1 hour in seconds
    });

    it('should return cached response when idempotency key exists', async () => {
      const cachedResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'cached', timestamp: 1234567890 })
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'existing-key-456'
        },
        payload: { data: 'test' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-idempotent-replay']).toBe('true');

      const responseData = JSON.parse(response.payload);
      expect(responseData.message).toBe('cached');
      expect(responseData.timestamp).toBe(1234567890);

      // Should not call setex for cached responses
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'test-key-error'
        },
        payload: { data: 'test' }
      });

      // Should continue processing despite Redis error
      expect(response.statusCode).toBe(200);
      const responseData = JSON.parse(response.payload);
      expect(responseData.message).toBe('success');
    });

    it('should handle malformed cached data', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'malformed-key'
        },
        payload: { data: 'test' }
      });

      // Should continue processing despite malformed cache
      expect(response.statusCode).toBe(200);
      const responseData = JSON.parse(response.payload);
      expect(responseData.message).toBe('success');
    });

    it('should validate idempotency key format', async () => {
      // Test empty string
      const emptyResponse = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': ''
        },
        payload: { data: 'test' }
      });
      expect(emptyResponse.statusCode).toBe(400);
      const emptyData = JSON.parse(emptyResponse.payload);
      expect(emptyData.error).toContain('Invalid Idempotency-Key');

      // Test whitespace-only string
      const whitespaceResponse = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': '   '
        },
        payload: { data: 'test' }
      });
      expect(whitespaceResponse.statusCode).toBe(400);
      const whitespaceData = JSON.parse(whitespaceResponse.payload);
      expect(whitespaceData.error).toContain('Invalid Idempotency-Key');

      // Test too long string
      const longResponse = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'a'.repeat(256)
        },
        payload: { data: 'test' }
      });
      expect(longResponse.statusCode).toBe(400);
      const longData = JSON.parse(longResponse.payload);
      expect(longData.error).toContain('Invalid Idempotency-Key');
    });

    it('should accept valid idempotency key formats', async () => {
      const validKeys = [
        'simple-key',
        'key-with-numbers-123',
        'KEY_WITH_UNDERSCORES',
        'uuid-like-12345678-1234-1234-1234-123456789012'
      ];

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      for (const validKey of validKeys) {
        const response = await app.inject({
          method: 'POST',
          url: '/test',
          headers: {
            'Idempotency-Key': validKey
          },
          payload: { data: 'test' }
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('should set correct cache expiration time', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Idempotency-Key': 'expiration-test'
        },
        payload: { data: 'test' }
      });

      expect(mockRedis.setex).toHaveBeenCalled();
      const setexCall = mockRedis.setex.mock.calls[0] as unknown as [string, number, string];
      expect(setexCall[1]).toBe(3600); // 1 hour in seconds
    });
  });
});
