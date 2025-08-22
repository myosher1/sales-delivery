import { FastifyPluginAsync, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

// Extend Fastify types to include our custom properties
declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

const IDEMPOTENCY_HEADER = 'idempotency-key';
const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

const idempotencyMiddleware: FastifyPluginAsync = async (fastify) => {
  // Only process requests that can be idempotent
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    // Only apply to POST, PATCH, and PUT methods
    if (!['POST', 'PATCH', 'PUT'].includes(request.method)) {
      return done();
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER.toLowerCase()] as string;

    // If no idempotency key is provided, continue normally
    if (!idempotencyKey) {
      return done();
    }

    // Store the idempotency key in the request for later use
    request.idempotencyKey = idempotencyKey;
    const cacheKey = `idempotency:${idempotencyKey}`;

    // Check if we've seen this request before
    fastify.redis.get(cacheKey).then((cachedResponse) => {
      if (cachedResponse) {
        const { statusCode, headers, body } = JSON.parse(cachedResponse);

        // Set the original request idempotency key in the response
        reply.header('X-Idempotent-Replay', 'true');

        // Send the cached response
        return reply
          .status(statusCode as number)
          .headers(headers as Record<string, string>)
          .send(body);
      }

      // Store the original reply.send method
      const originalSend = reply.send;

      // Override the send method to cache the response
      reply.send = function (data: unknown) {
        // Only cache successful responses (2xx)
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
          const responseToCache = {
            statusCode: reply.statusCode,
            headers: reply.getHeaders(),
            body: data,
          };

          // Cache the response for future requests
          fastify.redis.set(cacheKey, JSON.stringify(responseToCache), 'EX', IDEMPOTENCY_TTL)
            .catch((error: Error) => {
              fastify.log.error(`Failed to cache idempotent response: ${error.message}`);
            });
        }

        // Call the original send method
        return originalSend.call(this, data);
      };

      done();
    }).catch(done);
  });
};

export default idempotencyMiddleware;
