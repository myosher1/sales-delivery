import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { deliveries } from '../db/schema.js';

export const deliveryService = {
  async createDelivery(deliveryData: any) {
    try {
      const [newDelivery] = await db
        .insert(deliveries)
        .values({
          ...deliveryData,
          status: 'PENDING', 
        })
        .returning();
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

  async updateDeliveryStatus(id: number, status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED') {
    try {
      const [updatedDelivery] = await db
        .update(deliveries)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(deliveries.id, id))
        .returning();
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