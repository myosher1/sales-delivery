import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { inventoryService } from '../services/inventory.service.js';

interface CheckAvailabilityRequest {
  Body: {
    items: Array<{
      productId: string;
      quantity: number;
    }>;
  };
}

export async function inventoryRoutes(fastify: FastifyInstance) {
  // Check inventory availability endpoint
  fastify.post<CheckAvailabilityRequest>('/check-availability', async (request: FastifyRequest<CheckAvailabilityRequest>, reply: FastifyReply) => {
    try {
      const { items } = request.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({
          error: 'Invalid request',
          message: 'Items array is required and must not be empty'
        });
      }

      // Validate items structure
      for (const item of items) {
        if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return reply.status(400).send({
            error: 'Invalid item format',
            message: 'Each item must have productId (string) and quantity (positive number)'
          });
        }
      }

      fastify.log.info(`Checking availability for ${items.length} items`);

      const availabilityResults = await inventoryService.checkAvailability(items);

      // Check if all items are available
      const allAvailable = availabilityResults.every(result => result.available);
      const unavailableItems = availabilityResults.filter(result => !result.available);

      const response = {
        available: allAvailable,
        items: availabilityResults,
        unavailableItems: unavailableItems.length > 0 ? unavailableItems : undefined
      };

      fastify.log.info(`Availability check completed. All available: ${allAvailable}`);

      return reply.status(200).send(response);
    } catch (error: any) {
      fastify.log.error('Error checking inventory availability:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to check inventory availability'
      });
    }
  });

}
