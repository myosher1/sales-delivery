// src/app.ts
import Fastify from 'fastify';
import { inventoryRoutes } from './routes/inventory.js';
import { rabbitmqPlugin } from './plugins/rabbitmq.js';  // Add this back
import { db } from './db/connection.js';
import {sql} from "drizzle-orm";

const server = Fastify({
  logger: true
});

// Register routes
server.register(rabbitmqPlugin);
server.register(inventoryRoutes);

// Health check endpoint
server.get('/health', async (request, reply) => {
  try {
    // Check database connection
      await db.execute(sql`SELECT 1`);

    return { status: 'ok', service: 'inventory-service' };
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ status: 'error', message: 'Service unavailable' });
  }
});

// Start the server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3003');
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`Inventory service is running on http://${host}:${port}`);
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
