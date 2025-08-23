import fp from 'fastify-plugin';
import amqp, { Connection, Channel } from 'amqplib';
import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { orders } from '../db/schema.js';
import { eq } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyInstance {
    rabbitmq: {
      connection: any;
      channel: any;
      reserveStock: (orderId: string, items: Array<{ productId: string; quantity: number }>) => Promise<void>;
      publishOrderEvent: (orderData: any) => Promise<void>;
    };
  }
}

const rabbitmqPlugin = async (fastify: FastifyInstance) => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    
    // Declare queues
    await channel.assertQueue('delivery_queue', { durable: true });
    await channel.assertQueue('order_status_queue', { durable: true });
    await channel.assertQueue('inventory_check_queue', { durable: true });
    await channel.assertQueue('inventory_response_queue', { durable: true });
    await channel.assertQueue('stock_reservation_queue', { durable: true });
    
    // Store pending inventory requests
    const pendingInventoryRequests = new Map();
    
    // Function to check inventory via RabbitMQ
    const checkInventory = (items: Array<{ productId: string; quantity: number }>): Promise<any> => {
      return new Promise((resolve, reject) => {
        const correlationId = `inv_${Date.now()}_${Math.random()}`;
        
        // Store the promise resolvers
        pendingInventoryRequests.set(correlationId, { resolve, reject });
        
        // Send inventory check request
        const message = {
          correlationId,
          items
        };
        
        channel.sendToQueue(
          'inventory_check_queue',
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        
        // Set timeout for request
        setTimeout(() => {
          if (pendingInventoryRequests.has(correlationId)) {
            pendingInventoryRequests.delete(correlationId);
            reject(new Error('Inventory check timeout'));
          }
        }, 10000); // 10 second timeout
      });
    };
    
    // Consume inventory responses
    await channel.consume('inventory_response_queue', async (msg) => {
      if (msg) {
        try {
          const response = JSON.parse(msg.content.toString());
          const { correlationId } = response;
          
          if (pendingInventoryRequests.has(correlationId)) {
            const { resolve } = pendingInventoryRequests.get(correlationId);
            pendingInventoryRequests.delete(correlationId);
            resolve(response);
          }
          
          channel.ack(msg);
        } catch (error : any) {
          fastify.log.error('Error processing inventory response:', error);
          channel.ack(msg);
        }
      }
    });
    
    // Consume delivery status updates (existing functionality)
    await channel.consume('order_status_queue', async (msg) => {
      if (msg) {
        try {
          const { orderId, status, deliveryId } = JSON.parse(msg.content.toString());
          
          fastify.log.info(`Received delivery status update for order ${orderId}: ${status}`);
          
          // Update order status in database
          await db.update(orders)
            .set({ 
              status,
              updatedAt: new Date()
            })
            .where(eq(orders.id, orderId));
          
          fastify.log.info(`Order ${orderId} status updated to: ${status}`);
          channel.ack(msg);
        } catch (error: any) {
          fastify.log.error('Error processing delivery status update:', error);
          channel.ack(msg);
        }
      }
    });
    
    // Reserve stock function
    const reserveStock = async (orderId: string, items: Array<{ productId: string; quantity: number }>) => {
      try {
        const message = { orderId, items };
        await channel.sendToQueue(
          'stock_reservation_queue',
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        fastify.log.info(`Stock reservation request sent for order: ${orderId}`);
      } catch (error: any) {
        fastify.log.error('Error sending stock reservation request:', error);
        throw error;
      }
    };

    // Publish order created event function
    const publishOrderEvent = async (orderData: any) => {
      try {
        const message = {
          type: 'ORDER_CREATED',
          orderId: orderData.id,
          customerId: orderData.customerId,
          shippingAddress: orderData.shippingAddress,
          items: orderData.items,
          totalAmount: orderData.totalAmount,
          createdAt: orderData.createdAt
        };
        
        await channel.sendToQueue(
          'delivery_queue',
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        fastify.log.info(`Order event published for order: ${orderData.id}`);
      } catch (error: any) {
        fastify.log.error('Error publishing order event:', error);
        throw error;
      }
    };

    // Decorate fastify instance
    fastify.decorate('rabbitmq', { 
      connection, 
      channel,
      reserveStock,
      publishOrderEvent
    });
    
    fastify.log.info('RabbitMQ plugin registered successfully');
    
    // Graceful shutdown
    fastify.addHook('onClose', async () => {
      await channel.close();
      await connection.close();
    });
    
  } catch (error : any) {
    fastify.log.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
};

// Export as a proper Fastify plugin using fp() to ensure it's available across all contexts
export default fp(rabbitmqPlugin, {
  name: 'rabbitmq-plugin'
});

export { rabbitmqPlugin };
