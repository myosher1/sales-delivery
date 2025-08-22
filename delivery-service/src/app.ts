// src/app.ts
import Fastify from 'fastify';
import { rabbitmqPlugin } from './plugins/rabbitmq.js';
import { db } from './db/connection.js';
import {sql} from "drizzle-orm";

const server = Fastify({
  logger: true
});

// Register plugins
server.register(rabbitmqPlugin);

// Health check endpoint
server.get('/health', async (request, reply) => {
  try {
    // Check database connection
      await db.execute(sql`SELECT 1`);
    
    // Check RabbitMQ connection
    if (!server.rabbitmq?.channel) {
      throw new Error('RabbitMQ not connected');
    }
    
    return { status: 'ok' };
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ status: 'error', message: 'Service unavailable' });
  }
});

// Start the server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3002');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await server.close();
  process.exit(0);
});

start();