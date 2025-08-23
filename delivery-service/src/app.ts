// src/app.ts
import Fastify from 'fastify';
import rabbitmqPlugin from './plugins/rabbitmq.js';
import { deliveryRoutes } from './routes/delivery.js';
import { db } from './db/connection.js';
import {sql} from "drizzle-orm";

const server = Fastify({
  logger: true
});

// Health check endpoint
server.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);

    // Check RabbitMQ connection status (don't fail if disconnected)
    const rabbitmqStatus = server.rabbitmq?.channel ? 'connected' : 'disconnected';

    return {
      status: 'ok',
      service: 'delivery-service',
      rabbitmq: rabbitmqStatus
    };
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ status: 'error', message: 'Service unavailable' });
  }
});

// Start the server
const start = async () => {
  try {
    // Register plugins first and await them
    console.log('DEBUG: About to register RabbitMQ plugin...');
    await server.register(rabbitmqPlugin);
    console.log('DEBUG: RabbitMQ plugin registered successfully');
    console.log('DEBUG: server.rabbitmq available:', !!server.rabbitmq);
    
    console.log('DEBUG: About to register delivery routes...');
    await server.register(deliveryRoutes);
    console.log('DEBUG: Delivery routes registered successfully');
    
    const port = parseInt(process.env.PORT || '3002');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    console.error('DEBUG: Error during server startup:', err);
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