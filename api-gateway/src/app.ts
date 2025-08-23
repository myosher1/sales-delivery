import Fastify, {FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {IncomingMessage, Server, ServerResponse} from 'http';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import redisPlugin from './plugins/redis.js';
import fastifyReplyFrom from '@fastify/reply-from';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import { idempotencyPreHandler } from './middleware/idempotency.js';
import {fileURLToPath} from 'url';
import path from 'path';
import fetch from 'node-fetch';


// Define the Fastify instance type with explicit server types
type FastifyApp = FastifyInstance<
    Server,
    IncomingMessage,
    ServerResponse,
    FastifyBaseLogger
>;

export async function buildApp(opts = {}): Promise<FastifyApp> {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const app = Fastify({
        ...opts,
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            ...(isDevelopment && {
                transport: {
                    target: 'pino-pretty',
                    options: {
                        translateTime: 'HH:MM:ss Z',
                        ignore: 'pid,hostname',
                    }
                }
            })
        },
        bodyLimit: 1048576, // Set the maximum allowed payload, defaults to 1MB
        // Add any additional Fastify options here
    });

    // Register plugins
    await app.register(fastifyCors, {
        origin: process.env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',')
            : '*',
        credentials: true
    });

    await app.register(fastifyHelmet);

    // Register reply-from plugin
    await app.register(fastifyReplyFrom, {
        base: process.env.SALES_SERVICE_URL || 'http://sales-service:3000'
    });

    // Register Redis with configuration
    try {
        await app.register(redisPlugin, {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            connectionTimeout: 5000, // 5 seconds
            maxRetriesPerRequest: 3,
            // Add any additional Redis options here
        });

        // Test Redis connection
        try {
            await app.redis.ping();
            app.log.info('Redis connection verified');
        } catch (err) {
            app.log.warn({err}, 'Could not verify Redis connection, continuing without it');
        }
    } catch (err) {
        // If Redis connection fails, create a mock Redis client
        app.log.warn({err}, 'Redis connection failed, using mock client');

    }

    // Explicit route for POST /api/sales with idempotency middleware
    app.post('/api/sales',
        // Add idempotency middleware
        {preHandler: idempotencyPreHandler},

        async (request, reply) => {
            const target = new URL('/orders', process.env.SALES_SERVICE_URL || 'http://sales-service:3000');

            // Stringify headers for logging
            const headersForLogging = Object.fromEntries(
                Object.entries(request.headers).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? value.join(', ') : value
                ])
            );

            app.log.info('Incoming request headers: %j', headersForLogging);
            app.log.info({body: request.body}, 'Request body');

            if (!request.body) {
                app.log.error('Request body is empty');
                return reply.status(400).send({error: 'Request body is required'});
            }

            try {
                // Convert the body to a string if it's not already
                const bodyString = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

                // Convert headers to ensure all values are strings
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'host': target.host,
                    'x-forwarded-for': Array.isArray(request.headers['x-forwarded-for'])
                        ? request.headers['x-forwarded-for'][0]
                        : (request.headers['x-forwarded-for'] || request.socket.remoteAddress || ''),
                    'x-forwarded-proto': Array.isArray(request.headers['x-forwarded-proto'])
                        ? request.headers['x-forwarded-proto'][0]
                        : (request.headers['x-forwarded-proto'] || 'http'),
                    'x-forwarded-host': Array.isArray(request.headers['x-forwarded-host'])
                        ? request.headers['x-forwarded-host'][0]
                        : (request.headers['x-forwarded-host'] || request.headers.host || '')
                };

                // Make the request to the sales service
                const response = await fetch(target.toString(), {
                    method: 'POST',
                    headers,
                    body: bodyString
                });

                // Get the response body as text
                const responseBody = await response.text();

                // Convert Headers to a plain object
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                // The idempotency middleware will handle caching the response
                if (request.idempotencyKey) {
                    reply.header('X-Idempotent-Key', request.idempotencyKey);
                }

                // Send the response
                return reply
                    .status(response.status)
                    .headers(responseHeaders)
                    .send(responseBody);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                app.log.error(`Error processing request: ${errorMessage}`);
                return reply.status(500).send({
                    error: 'Error processing request',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    // Proxy all other /api/sales/* requests
    await app.register(fastifyHttpProxy, {
        upstream: process.env.SALES_SERVICE_URL || 'http://sales-service:3000',
        prefix: '/api/sales',
        rewritePrefix: '/',
        http2: false,
        websocket: false,
        httpMethods: ['DELETE', 'GET', 'HEAD', 'PATCH', 'PUT', 'OPTIONS'],
        replyOptions: {
            rewriteRequestHeaders: (request: FastifyRequest, headers: Record<string, string | string[] | undefined>) => {
                const newHeaders = {...headers};
                newHeaders.host = new URL(process.env.SALES_SERVICE_URL || 'http://sales-service:3000').host;
                newHeaders['x-forwarded-for'] = request.headers['x-forwarded-for'] || request.socket.remoteAddress || '';
                newHeaders['x-forwarded-proto'] = request.headers['x-forwarded-proto'] || 'http';
                newHeaders['x-forwarded-host'] = request.headers['x-forwarded-host'] || request.headers.host || '';
                return newHeaders;
            }
        }
    } as FastifyHttpProxyOptions);
    return app as FastifyApp;
}

// Start the server if this file is run directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
    (async () => {
        try {
            const app = await buildApp({
                logger: true,
                trustProxy: true,
            });

            const port = Number(process.env.PORT) || 3000;
            const host = process.env.HOST || '0.0.0.0';

            await app.listen({port, host});
            console.log(`Server listening on http://${host}:${port}`);
        } catch (err) {
            console.error('Error starting server:', err);
            process.exit(1);
        }
    })();
}
