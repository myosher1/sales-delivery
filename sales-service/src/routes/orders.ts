import {randomUUID} from 'crypto';
import {db} from '../db/connection.js';
import * as schema from '../db/schema.js';
import { inventoryClient } from '../services/inventory.client.js';
import {eq} from 'drizzle-orm';
import {
    CreateOrderBody,
    createOrderSchema,
    GetOrderParams,
    getOrderSchema,
    UpdateOrderStatusBody,
    UpdateOrderStatusParams,
    updateOrderStatusSchema
} from '../types/index.js';
import {FastifyPluginAsync} from "fastify";

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface CreateOrderRequest {
  customerId: string;
  customerEmail: string;
  shippingAddress: string;
  items: OrderItem[];
}

export const ordersRoute: FastifyPluginAsync = async (app) => {
  // Create new order
  app.post('/orders', { schema: createOrderSchema }, async (request, reply) => {
    const { customerId, customerEmail, shippingAddress, items } = request.body as CreateOrderBody;
    
    try {
      // Step 1: Validate inventory via RabbitMQ
        app.log.info('Checking inventory availability via HTTP...');

      const inventoryItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      const inventoryResponse = await inventoryClient.checkAvailability(inventoryItems);
      // Check if inventory validation failed
      if (!inventoryResponse.available) {
        reply.status(400).send({
          error: 'Order cannot be processed due to product availability issues',
          unavailableProducts: inventoryResponse.unavailableItems || inventoryResponse.items?.filter((item: any) => !item.available)
        });
        return;
      }

      // Step 2: Calculate total amount
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      
      // Step 3: Create order
      const orderId = randomUUID();
      
      const [newOrder] = await db.insert(schema.orders).values({
        id: orderId,
        customerId,
        customerEmail,
        shippingAddress,
        totalAmount: totalAmount.toFixed(2),
        status: 'Pending Shipment'
      }).returning();
      
      // Step 4: Create order items
      const orderItems = items.map(item => ({
        id: randomUUID(),
        orderId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        totalPrice: (item.quantity * item.unitPrice).toFixed(2)
      }));
      
      await db.insert(schema.orderItems).values(orderItems);
      
      // Step 5: Reserve stock via RabbitMQ
      app.log.info('Reserving stock via RabbitMQ...');
      await app.rabbitmq.reserveStock(orderId, inventoryItems);
      
      // Step 6: Publish order event to RabbitMQ for delivery service
      try {
        await app.rabbitmq.publishOrderEvent(newOrder);
        app.log.info(`Order event published for order ${newOrder.id}`);
      } catch (rabbitError: any) {
        app.log.error('Failed to publish order event:', rabbitError);
        // Don't fail the order creation if RabbitMQ fails
      }
      
      reply.status(201).send({
        orderId: newOrder.id,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        message: 'Order created successfully with inventory validation and delivery process initiated'
      });
      
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({ error: 'Failed to create order' });
    }
  });
  
  // Get order by ID
  app.get('/orders/:orderId', { schema: getOrderSchema }, async (request, reply) => {
    const { orderId } = request.params as GetOrderParams;
    
    try {
      const order = await db.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        with: {
          orderItems: true
        }
      });
      
      if (!order) {
        reply.status(404).send({ error: 'Order not found' });
        return;
      }
      
      reply.send({
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.orderItems || []
      });
      
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch order' });
    }
  });
  
  // Update order status
  app.patch('/orders/:orderId/status', { schema: updateOrderStatusSchema }, async (request, reply) => {
    const { orderId } = request.params as UpdateOrderStatusParams;
    const { status } = request.body as UpdateOrderStatusBody;
    
    try {
      const [updatedOrder] = await db.update(schema.orders)
        .set({ 
          status: status as schema.OrderStatus,
          updatedAt: new Date()
        })
        .where(eq(schema.orders.id, orderId))
        .returning();
      
      if (!updatedOrder) {
        reply.status(404).send({ error: 'Order not found' });
        return;
      }
      
      reply.send({
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        message: `Order status updated to ${status}`
      });
      
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({ error: 'Failed to update order status' });
    }
  });
};
