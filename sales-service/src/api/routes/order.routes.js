const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const orderController = require('../controllers/order.controller');
const validateRequest = require('../../middleware/validate-request');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  [
    body('customerId').isUUID().withMessage('Valid customer ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one order item is required'),
    body('items.*.productId').isUUID().withMessage('Valid product ID is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    validateRequest
  ],
  orderController.createOrder
);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         schema:
 *           type: string
 *         required: true
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:orderId',
  [
    param('orderId').isUUID().withMessage('Valid order ID is required'),
    validateRequest
  ],
  orderController.getOrderById
);

/**
 * @swagger
 * /api/orders/customer/{customerId}:
 *   get:
 *     summary: Get all orders for a customer
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         schema:
 *           type: string
 *         required: true
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: List of customer's orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid customer ID
 *       500:
 *         description: Server error
 */
router.get(
  '/customer/:customerId',
  [
    param('customerId').isUUID().withMessage('Valid customer ID is required'),
    validateRequest
  ],
  orderController.getCustomerOrders
);

/**
 * @swagger
 * /api/orders/{orderId}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         schema:
 *           type: string
 *         required: true
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Order cannot be cancelled
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:orderId/cancel',
  [
    param('orderId').isUUID().withMessage('Valid order ID is required'),
    validateRequest
  ],
  orderController.cancelOrder
);

module.exports = router;
