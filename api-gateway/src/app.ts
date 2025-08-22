import Fastify, {FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {IncomingMessage, Server, ServerResponse} from 'http';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import redisPlugin from './plugins/redis.js';
import fastifyReplyFrom from '@fastify/reply-from';
import fastifyHttpProxy, { FastifyHttpProxyOptions } from '@fastify/http-proxy';
import idempotencyMiddleware from './middleware/idempotency.js';
import {fileURLToPath} from 'url';
import path from 'path';

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

    // Register idempotency middleware as a plugin
    await app.register(idempotencyMiddleware);

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

    // Explicit route for POST /api/sales with idempotency
    app.post('/api/sales', async (request, reply) => {
        const target = new URL('/orders', process.env.SALES_SERVICE_URL || 'http://sales-service:3000');

        // Log the incoming request body for debugging
        console.log('Request body:', request.body);

        if (!request.body) {
            return reply.status(400).send({ error: 'Request body is required' });
        }

        try {
            return reply.from(target.toString(), {
                method: 'POST',
                body: JSON.stringify(request.body),  // Manually stringify the request body
                rewriteRequestHeaders: (req: IncomingMessage, headers: Record<string, string | string[] | undefined>) => ({
                    ...headers,
                    'content-type': 'application/json',
                    'host': target.host,
                    'x-forwarded-for': request.headers['x-forwarded-for'] || request.socket.remoteAddress || '',
                    'x-forwarded-proto': request.headers['x-forwarded-proto'] || 'http',
                    'x-forwarded-host': request.headers['x-forwarded-host'] || request.headers.host || ''
                })
            } as any);
        } catch (error) {
            console.error('Error forwarding request:', error);
            return reply.status(500).send({ error: 'Internal server error' });
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
                const newHeaders = { ...headers };
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
