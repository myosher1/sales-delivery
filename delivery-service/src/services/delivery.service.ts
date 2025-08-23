import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { deliveries } from '../db/schema.js';

// Add interface for the fastify instance parameter
interface FastifyInstance {
  rabbitmq?: {
    publishStatusUpdate: (orderId: string, status: string, deliveryId?: number) => Promise<void>;
  };
  log?: any;
}

export const deliveryService = {
  async createDelivery(deliveryData: any, fastify?: FastifyInstance) {
    try {
      const [newDelivery] = await db
        .insert(deliveries)
        .values({
          ...deliveryData,
          status: 'PENDING', 
        })
        .returning();
      
      // Publish status update if fastify instance is provided
      if (fastify?.rabbitmq && newDelivery.orderId) {
        try {
          await fastify.rabbitmq.publishStatusUpdate(newDelivery.orderId.toString(), 'PENDING', newDelivery.id);
        } catch (error) {
          fastify.log?.error('Failed to publish delivery creation status:', error);
        }
      }
      
      return newDelivery;
    } catch (error) {
      console.error('Error creating delivery:', error);
      throw error;
    }
  },

  async getDeliveryById(id: number) {
    try {
      const [delivery] = await db
        .select()
        .from(deliveries)
        .where(eq(deliveries.id, id));
      return delivery;
    } catch (error) {
      console.error('Error getting delivery:', error);
      throw error;
    }
  },

  async updateDeliveryStatus(id: number, status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED', fastify?: FastifyInstance) {
    try {
      const [updatedDelivery] = await db
        .update(deliveries)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(deliveries.id, id))
        .returning();
      
      // Publish status update if fastify instance is provided
      if (fastify?.rabbitmq && updatedDelivery?.orderId) {
        try {
          await fastify.rabbitmq.publishStatusUpdate(updatedDelivery.orderId.toString(), status, updatedDelivery.id);
        } catch (error) {
          fastify.log?.error('Failed to publish delivery status update:', error);
        }
      }
      
      return updatedDelivery;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      throw error;
    }
  },

  async listDeliveries() {
    try {
      return await db.select().from(deliveries);
    } catch (error) {
      console.error('Error listing deliveries:', error);
      throw error;
    }
  }
};