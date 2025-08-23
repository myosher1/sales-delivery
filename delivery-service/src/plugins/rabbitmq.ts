import * as amqp from 'amqplib';
import { FastifyPluginAsync } from 'fastify';
import { deliveryService } from '../services/delivery.service.js';

// Default configuration
const DEFAULT_CONFIG = {
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
  queue: 'delivery_queue',
  statusQueue: 'status_queue'
};

// Type augmentation for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    rabbitmq: {
      channel: any;
      connection: any;
      publishStatusUpdate: (orderId: string, status: string, deliveryId?: number) => Promise<void>;
    };
  }
}

const rabbitmqPlugin: FastifyPluginAsync = async (fastify, options) => {
  const config = {
    ...DEFAULT_CONFIG,
    ...options
  };

  try {
    // Connect to RabbitMQ
    fastify.log.info(`Connecting to RabbitMQ at ${config.url}...`);
    const connection = await amqp.connect(config.url);
    const channel = await connection.createChannel();

    // Assert the delivery queue
    fastify.log.info(`Setting up queue: ${config.queue}`);
    await channel.assertQueue(config.queue, { durable: true });

    // Assert the status queue
    fastify.log.info(`Setting up status queue: ${config.statusQueue}`);
    await channel.assertQueue(config.statusQueue, { durable: true });

    // Helper function to publish status updates
    const publishStatusUpdate = async (orderId: string, status: string, deliveryId?: number) => {
      const message = {
        type: 'DELIVERY_STATUS_UPDATE',
        orderId,
        status,
        deliveryId,
        timestamp: new Date().toISOString()
      };

      await channel.sendToQueue(
        config.statusQueue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      fastify.log.info(`Published status update for order ${orderId}: ${status}`);
    };

    // Store the connection and channel in the Fastify instance
    fastify.decorate('rabbitmq', {
      channel,
      connection: connection as unknown as amqp.Connection,
      publishStatusUpdate
    });

    // Consume messages from the queue
    fastify.log.info('Starting message consumer...');
    await channel.consume(config.queue, async (msg) => {
      if (!msg) return;

      try {
        const message = JSON.parse(msg.content.toString());
        fastify.log.info('Received message from queue:', message);

        // Process the message based on its type
        switch (message.type) {
          case 'ORDER_CREATED':
            await deliveryService.createDelivery({
              orderId: message.orderId,
              customerId: message.customerId || 0, // Default customerId if not provided
              address: message.shippingAddress || {},
              status: 'PENDING',
            }, fastify);
            fastify.log.info(`Created delivery for order ${message.orderId}`);
            break;

          case 'ORDER_CANCELLED':
            fastify.log.info(`Processing cancellation for order ${message.orderId}`);
            // Add cancellation logic here if needed
            break;

          default:
            fastify.log.warn('Unknown message type:', message.type);
        }

        // Acknowledge the message
        channel.ack(msg);
      } catch (error: any) {
        fastify.log.error('Error processing message:', error?.message || error);
        // Reject the message and don't requeue it
        channel.nack(msg, false, false);
      }
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      fastify.log.info('Closing RabbitMQ connection...');
      try {
        await channel.close();
        await connection.close();
        fastify.log.info('RabbitMQ connection closed');
      } catch (error: any) {
        fastify.log.error('Error closing RabbitMQ connection:', error?.message || error);
      }
    };

    fastify.addHook('onClose', shutdown);

    fastify.log.info('RabbitMQ plugin initialized successfully');
  } catch (error: any) {
    fastify.log.error('Failed to initialize RabbitMQ plugin:', error?.message || error);
    throw error;
  }
};

export { rabbitmqPlugin };
// Add this for backward compatibility
export default rabbitmqPlugin;