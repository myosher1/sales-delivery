import * as amqp from 'amqplib';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { deliveryService } from '../services/delivery.service.js';

// Default configuration
const DEFAULT_CONFIG = {
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
  queue: 'delivery_queue',
  statusQueue: 'order_status_queue'
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

const rabbitmqPlugin = fp(async (fastify, options) => {
  const config = {
    ...DEFAULT_CONFIG,
    ...options
  };

  try {
    console.log('DEBUG: RabbitMQ plugin starting initialization...');
    console.log('DEBUG: RabbitMQ URL:', config.url);
    
    // Connect to RabbitMQ
    fastify.log.info(`Connecting to RabbitMQ at ${config.url}...`);
    console.log('DEBUG: About to connect to RabbitMQ...');
    const connection = await amqp.connect(config.url);
    console.log('DEBUG: RabbitMQ connection established');
    
    const channel = await connection.createChannel();
    console.log('DEBUG: RabbitMQ channel created');

    // Assert the delivery queue
    fastify.log.info(`Setting up queue: ${config.queue}`);
    console.log('DEBUG: Setting up delivery queue...');
    await channel.assertQueue(config.queue, { durable: true });
    console.log('DEBUG: Delivery queue setup complete');

    // Assert the status queue
    fastify.log.info(`Setting up status queue: ${config.statusQueue}`);
    console.log('DEBUG: Setting up status queue...');
    await channel.assertQueue(config.statusQueue, { durable: true });
    console.log('DEBUG: Status queue setup complete');

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
    console.log('DEBUG: About to decorate Fastify instance with RabbitMQ...');
    fastify.decorate('rabbitmq', {
      channel,
      connection: connection as unknown as amqp.Connection,
      publishStatusUpdate
    });
    console.log('DEBUG: Fastify instance decorated successfully');
    console.log('DEBUG: Checking if fastify.rabbitmq exists:', !!fastify.rabbitmq);
    if (!fastify.rabbitmq) {
      console.error('DEBUG: fastify.rabbitmq is false. This could be due to a number of reasons, including but not limited to:');
      console.error('DEBUG: 1. The decorate method was not called correctly.');
      console.error('DEBUG: 2. The decorate method was called with an invalid or null value.');
      console.error('DEBUG: 3. There was an error in the code that prevented the decorate method from being called.');
      console.error('DEBUG: Please check the code and the Fastify documentation for more information.');
    }

    // Consume messages from the queue
    fastify.log.info('Starting message consumer...');
    console.log('DEBUG: Starting message consumer...');
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
      console.log('DEBUG: Closing RabbitMQ connection...');
      try {
        await channel.close();
        await connection.close();
        fastify.log.info('RabbitMQ connection closed');
        console.log('DEBUG: RabbitMQ connection closed');
      } catch (error: any) {
        fastify.log.error('Error closing RabbitMQ connection:', error?.message || error);
        console.log('DEBUG: Error closing RabbitMQ connection:', error?.message || error);
      }
    };

    fastify.addHook('onClose', shutdown);

    fastify.log.info('RabbitMQ plugin initialized successfully');
    console.log('DEBUG: RabbitMQ plugin initialized successfully');
  } catch (error: any) {
    fastify.log.error('Failed to initialize RabbitMQ plugin:', error?.message || error);
    console.log('DEBUG: Failed to initialize RabbitMQ plugin:', error?.message || error);
    throw error;
  }
});

export default rabbitmqPlugin;