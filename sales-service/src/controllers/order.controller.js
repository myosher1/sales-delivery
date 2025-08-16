const { v4: uuidv4 } = require('uuid');
const { CustomError } = require('../utils/errors');
const { query, getClient } = require('../db/pool');
const logger = require('../utils/logger');
const { publishEvent } = require('../services/event-publisher');

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - customerId
 *         - items
 *         - shippingAddress
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated ID of the order
 *         customerId:
 *           type: string
 *           format: uuid
 *           description: The ID of the customer placing the order
 *         status:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled, returned]
 *           default: pending
 *           description: The current status of the order
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - price
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the product
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: The quantity of the product
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 description: The price per unit at the time of order
 *         shippingAddress:
 *           type: object
 *           required:
 *             - street
 *             - city
 *             - state
 *             - postalCode
 *             - country
 *           properties:
 *             street:
 *               type: string
 *               description: Street address
 *             city:
 *               type: string
 *               description: City name
 *             state:
 *               type: string
 *               description: State or province
 *             postalCode:
 *               type: string
 *               description: Postal or ZIP code
 *             country:
 *               type: string
 *               description: Country name
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *           description: The total amount of the order
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the order was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the order was last updated
 */

/**
 * Create a new order
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const createOrder = async (req, res, next) => {
  const client = await getClient();

  try {
    const { customerId, items, shippingAddress, notes } = req.body;
    const orderId = uuidv4();
    const status = 'pending';

    // Calculate total amount (in a real app, you'd fetch prices from a product service)
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    await client.query('BEGIN');

    // Insert order
    const orderQuery = `
      INSERT INTO orders (
        id, customer_id, status, total_amount, shipping_address, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const orderValues = [
      orderId,
      customerId,
      status,
      totalAmount,
      JSON.stringify(shippingAddress),
      notes || null
    ];

    const orderResult = await client.query(orderQuery, orderValues);
    const order = orderResult.rows[0];

    // Insert order items
    const orderItemsQuery = `
      INSERT INTO order_items (
        order_id, product_id, quantity, price
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    for (const item of items) {
      await client.query(orderItemsQuery, [
        orderId,
        item.productId,
        item.quantity,
        item.price
      ]);
    }

    await client.query('COMMIT');

    // Publish order created event
    await publishEvent('order.created', {
      orderId: order.id,
      customerId: order.customer_id,
      status: order.status,
      totalAmount: order.total_amount,
      createdAt: order.created_at
    });

    logger.info(`Order created: ${order.id}`, { orderId: order.id, customerId });

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        status: order.status,
        totalAmount: order.total_amount,
        createdAt: order.created_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating order', { error: error.message, stack: error.stack });
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get order by ID
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderQuery = `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'createdAt', oi.created_at,
            'updatedAt', oi.updated_at
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `;

    const result = await query(orderQuery, [orderId]);

    if (result.rows.length === 0) {
      throw CustomError.notFound('Order not found');
    }

    const order = result.rows[0];

    // Convert database fields to camelCase for the API response
    const response = {
      id: order.id,
      customerId: order.customer_id,
      status: order.status,
      totalAmount: order.total_amount,
      shippingAddress: order.shipping_address,
      notes: order.notes,
      items: order.items[0] ? order.items : [],
      createdAt: order.created_at,
      updatedAt: order.updated_at
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all orders for a customer
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const getCustomerOrders = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { status, limit = 10, offset = 0 } = req.query;

    let queryText = `
      SELECT 
        id, 
        status, 
        total_amount as "totalAmount",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM orders 
      WHERE customer_id = $1
    `;

    const queryParams = [customerId];

    if (status) {
      queryText += ` AND status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    queryText += `
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(queryText, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        total: 0 // In a real app, you'd get this from a separate count query
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an order
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const cancelOrder = async (req, res, next) => {
  const client = await getClient();

  try {
    const { orderId } = req.params;

    await client.query('BEGIN');

    // Check if order exists and can be cancelled
    const checkOrderQuery = `
      SELECT status 
      FROM orders 
      WHERE id = $1 
      FOR UPDATE
    `;

    const checkResult = await client.query(checkOrderQuery, [orderId]);

    if (checkResult.rows.length === 0) {
      throw CustomError.notFound('Order not found');
    }

    const currentStatus = checkResult.rows[0].status;

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(currentStatus)) {
      throw CustomError.badRequest(
        `Order cannot be cancelled in its current state (${currentStatus})`
      );
    }

    // Update order status to cancelled
    const updateQuery = `
      UPDATE orders 
      SET status = 'cancelled', updated_at = NOW() 
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [orderId]);
    const updatedOrder = result.rows[0];

    await client.query('COMMIT');

    // Publish order cancelled event
    await publishEvent('order.cancelled', {
      orderId: updatedOrder.id,
      customerId: updatedOrder.customer_id,
      previousStatus: currentStatus,
      cancelledAt: updatedOrder.updated_at
    });

    logger.info(`Order cancelled: ${orderId}`, { orderId, previousStatus });

    res.json({
      message: 'Order cancelled successfully',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updated_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getCustomerOrders,
  cancelOrder,
};
