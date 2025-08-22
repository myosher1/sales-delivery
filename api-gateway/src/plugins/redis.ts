import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

interface RedisPluginOptions {
  host: string;
  port: number;
  connectionTimeout?: number;
  maxRetriesPerRequest?: number | null;
  [key: string]: any;
}

const redisPlugin = fp<RedisPluginOptions>(async function (fastify, options) {
  const { 
    host = 'localhost', 
    port = 6379,
    connectionTimeout = 5000, // 5 seconds
    maxRetriesPerRequest = 3,
    ...redisOptions 
  } = options;

  // Create a promise that resolves when Redis connects or rejects on timeout/error
  const redis = new Redis({
    host,
    port,
    connectTimeout: connectionTimeout,
    maxRetriesPerRequest,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const target = `${host}:${port}`;
      fastify.log.warn({ err, target }, 'Redis connection error, will retry');
      return true;
    },
    ...redisOptions
  });

  // Set up event handlers
  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis client error');
  });

  redis.on('connect', () => {
    fastify.log.info({ host, port }, 'Redis client connected');
  });

  // Add Redis to Fastify instance
  fastify.decorate('redis', redis);

  // Test the connection with a timeout
  const connectionTest = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Redis connection timeout after ${connectionTimeout}ms`));
    }, connectionTimeout);

    redis.ping()
      .then(() => {
        clearTimeout(timeout);
        fastify.log.info('Redis connected successfully');
        resolve();
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });

  try {
    await connectionTest;
  } catch (err: any) {
    fastify.log.error({ err }, 'Failed to connect to Redis');
    // Don't throw here, let the application continue without Redis
    // The application should handle missing Redis gracefully
  }

  // Close Redis connection when Fastify shuts down
  fastify.addHook('onClose', async (instance) => {
    try {
      await redis.quit();
      instance.log.info('Redis connection closed');
    } catch (err) {
      instance.log.warn({ err }, 'Error closing Redis connection');
    }
  });
}, {
  fastify: '4.x',
  name: 'redis-plugin'
});

export default redisPlugin;