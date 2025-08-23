import {FastifyPluginAsync} from 'fastify';
import {deliveryService} from '../services/delivery.service.js';

export const deliveryRoutes: FastifyPluginAsync = async (app) => {
    // Get all deliveries
    app.get('/deliveries', async (request, reply) => {
        try {
            const deliveries = await deliveryService.listDeliveries();
            reply.send(deliveries);
        } catch (error: any) {
            app.log.error('Error fetching deliveries:', error);
            reply.status(500).send({error: 'Failed to fetch deliveries'});
        }
    });

    // Get delivery by ID
    app.get('/deliveries/:id', async (request, reply) => {
        try {
            const {id} = request.params as { id: string };
            const delivery = await deliveryService.getDeliveryById(parseInt(id));

            if (!delivery) {
                reply.status(404).send({error: 'Delivery not found'});
                return;
            }

            reply.send(delivery);
        } catch (error: any) {
            app.log.error('Error fetching delivery:', error);
            reply.status(500).send({error: 'Failed to fetch delivery'});
        }
    });

    // Update delivery status (for testing)
    app.patch('/deliveries/:id/status', async (request, reply) => {
        try {
            const {id} = request.params as { id: string };
            const {status} = request.body as { status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' };

            if (!['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'].includes(status)) {
                reply.status(400).send({error: 'Invalid status. Must be one of: PENDING, IN_TRANSIT, DELIVERED, FAILED'});
                return;
            }

            const updatedDelivery = await deliveryService.updateDeliveryStatus(parseInt(id), status, app);

            if (!updatedDelivery) {
                reply.status(404).send({error: 'Delivery not found'});
                return;
            }

            reply.send({
                deliveryId: updatedDelivery.id,
                orderId: updatedDelivery.orderId,
                status: updatedDelivery.status,
                message: `Delivery status updated to ${status} and notification sent to sales service`
            });
        } catch (error: any) {
            app.log.error('Error updating delivery status:', error);
            reply.status(500).send({error: 'Failed to update delivery status'});
        }
    });
};