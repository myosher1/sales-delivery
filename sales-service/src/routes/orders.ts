import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db, schema } from '../db/connection.js';
import { eq } from 'drizzle-orm';
import {
  createOrderSchema,
  getOrderSchema,
  updateOrderStatusSchema,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody
} from '../types/index.js';

export const ordersRoute: FastifyPluginAsync = async (app) => {
  // Create new order
  app.post('/orders', { schema: createOrderSchema }, async (request, reply) => {
    const { customerId, customerEmail, shippingAddress, items } = request.body as CreateOrderBody;
    
    try {
      const orderId = randomUUID();
      
      // Calculate total amount
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      
      // Create order
      const [newOrder] = await db.insert(schema.orders).values({
        id: orderId,
        customerId,
        customerEmail,
        shippingAddress,
        totalAmount: totalAmount.toFixed(2),
        status: 'Pending Shipment'
      }).returning();
      
      // Create order items
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
      
      reply.status(201).send({
        orderId: newOrder.id,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        message: 'Order created successfully and delivery process initiated'
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
