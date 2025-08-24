// idempotency.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        idempotencyKey?: string;
    }
}

const IDEMPOTENCY_TTL = 60 * 60; // 1 hour in seconds

// Validate idempotency key format
const isValidIdempotencyKey = (key: string): boolean => {
    if (!key || key.trim() === '' || key.length > 255) {
        return false;
    }
    return true;
};

// The pre-handler function that can be used directly in routes
export const idempotencyPreHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for non-POST requests
    if (request.method !== 'POST') {
        return;
    }

    const idempotencyHeaderEntry = Object.entries(request.headers).find(
        ([key]) => key.toLowerCase() === 'idempotency-key'
    );

    // If no idempotency header provided at all, skip processing
    if (!idempotencyHeaderEntry) {
        return;
    }

    const idempotencyKey = Array.isArray(idempotencyHeaderEntry[1])
        ? idempotencyHeaderEntry[1][0]
        : idempotencyHeaderEntry[1];

    // If idempotency header exists but value is invalid, return error
    if (!isValidIdempotencyKey(idempotencyKey || '')) {
        return reply.status(400).send({
            error: 'Invalid Idempotency-Key format'
        });
    }

    request.idempotencyKey = idempotencyKey;
    const cacheKey = `idempotency:${idempotencyKey}`;

    try {
        const cachedResponse = await (request.server as any).redis.get(cacheKey);
        if (cachedResponse) {
            try {
                const { statusCode, headers, body } = JSON.parse(cachedResponse);
                reply.header('X-Idempotent-Replay', 'true');
                return reply
                    .status(statusCode)
                    .headers(headers)
                    .send(body);
            } catch (parseError) {
                // Malformed cached data - continue with normal processing
                console.warn('Failed to parse cached response, continuing with normal processing:', parseError);
            }
        }
    } catch (redisError) {
        // Redis connection error - continue with normal processing
        console.warn('Redis error during idempotency check, continuing with normal processing:', redisError);
    }

    // Store the original send method
    const originalSend = reply.send;
    reply.send = function (data: unknown) {
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
            const responseToCache = {
                statusCode: reply.statusCode,
                headers: reply.getHeaders(),
                body: data
            };
            
            // Try to cache the response, but don't fail if Redis is unavailable
            try {
                (request.server as any).redis.setex(
                    cacheKey,
                    IDEMPOTENCY_TTL,
                    JSON.stringify(responseToCache)
                );
            } catch (cacheError) {
                console.warn('Failed to cache response:', cacheError);
            }
        }
        return originalSend.call(reply, data);
    };
};

// The plugin that can be registered with fastify
const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', idempotencyPreHandler);
};

export default idempotencyPlugin;