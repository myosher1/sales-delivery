require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database configuration
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sales_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '2000', 10),
  },

  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queues: {
      orderCreated: 'order.created',
      orderStatusUpdated: 'order.status.updated',
    },
    exchange: 'sales',
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // 1 hour default TTL
  },

  // Application settings
  app: {
    name: 'Sales Service',
    version: '1.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    requestLimit: process.env.REQUEST_LIMIT || '100kb',
    sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
    jwtSecret: process.env.JWT_SECRET || 'jwt-secret-key',
  },

  // API settings
  api: {
    prefix: '/api',
    version: 'v1',
  },
};

// Export the config object based on the environment
module.exports = config;
