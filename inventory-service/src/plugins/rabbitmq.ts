import fp from 'fastify-plugin';
import * as amqp from 'amqplib';
import {FastifyInstance} from 'fastify';
import {inventoryService} from '../services/inventory.service.js';

declare module 'fastify' {
    interface FastifyInstance {
        rabbitmq: {
            connection: any;
            channel: any;
        };
    }
}

const rabbitmqPlugin = async (fastify: FastifyInstance) => {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

    try {
        // Connect to RabbitMQ
        const connection = await amqp.connect(rabbitmqUrl);
        const channel = await connection.createChannel();

        // Declare queues (only for stock operations)
        await channel.assertQueue('stock_reservation_queue', {durable: true});
        await channel.assertQueue('stock_release_queue', {durable: true});

        // Decorate fastify instance
        fastify.decorate('rabbitmq', {connection, channel});

        // Set up consumers

        // 1. Handle stock reservations (when order is confirmed)
        await channel.consume('stock_reservation_queue', async (msg) => {
            if (msg) {
                try {
                    const {orderId, items} = JSON.parse(msg.content.toString());
                    fastify.log.info(`Processing stock reservation for order: ${orderId}`);

                    await inventoryService.reserveStock(orderId, items);

                    fastify.log.info(`Stock reserved successfully for order: ${orderId}`);
                    channel.ack(msg);
                } catch (error: any) {
                    fastify.log.error(`Error reserving stock for order ${JSON.parse(msg.content.toString()).orderId}:`, error);
                    // In a production system, you might want to send this to a dead letter queue
                    channel.ack(msg);
                }
            }
        });

        // 2. Handle stock releases (when order is cancelled)
        await channel.consume('stock_release_queue', async (msg) => {
            if (msg) {
                try {
                    const {orderId, items} = JSON.parse(msg.content.toString());
                    fastify.log.info(`Processing stock release for order: ${orderId}`);

                    await inventoryService.releaseStock(orderId, items);

                    fastify.log.info(`Stock released successfully for order: ${orderId}`);
                    channel.ack(msg);
                } catch (error: any) {
                    fastify.log.error(`Error releasing stock for order ${JSON.parse(msg.content.toString()).orderId}:`, error);
                    channel.ack(msg);
                }
            }
        });

        fastify.log.info('RabbitMQ plugin registered successfully (stock operations only)');

        // Graceful shutdown
        fastify.addHook('onClose', async () => {
            await channel.close();
            await connection.close();
        });

    } catch (error: any) {
        fastify.log.error('Failed to connect to RabbitMQ:', error);
        throw error;
    }
};

export {rabbitmqPlugin};
