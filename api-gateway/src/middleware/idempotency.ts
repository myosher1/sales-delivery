// idempotency.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        idempotencyKey?: string;
    }
}

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

// The pre-handler function that can be used directly in routes
export const idempotencyPreHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for non-POST requests
    if (request.method !== 'POST') {
        return;
    }

    const idempotencyHeader = Object.entries(request.headers).find(
        ([key]) => key.toLowerCase() === 'idempotency-key'
    )?.[1];

    const idempotencyKey = Array.isArray(idempotencyHeader)
        ? idempotencyHeader[0]
        : idempotencyHeader;

    if (!idempotencyKey) {
        return;
    }

    request.idempotencyKey = idempotencyKey;
    const cacheKey = `idempotency:${idempotencyKey}`;

    const cachedResponse = await (request.server as any).redis.get(cacheKey);
    if (cachedResponse) {
        const { statusCode, headers, body } = JSON.parse(cachedResponse);
        reply.header('X-Idempotent-Replay', 'true');
        return reply
            .status(statusCode)
            .headers(headers)
            .send(body);
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
            (request.server as any).redis.setex(
                cacheKey,
                IDEMPOTENCY_TTL,
                JSON.stringify(responseToCache)
            );
        }
        return originalSend.call(reply, data);
    };
};

// The plugin that can be registered with fastify
const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', idempotencyPreHandler);
};

export default idempotencyPlugin;