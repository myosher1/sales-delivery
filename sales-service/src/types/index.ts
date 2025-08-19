import type { FromSchema } from 'json-schema-to-ts';
import { createOrderSchema, getOrderSchema, updateOrderStatusSchema } from './schemas.js';

// API Types from schemas
export type CreateOrderBody = FromSchema<typeof createOrderSchema.body>;
export type GetOrderParams = FromSchema<typeof getOrderSchema.params>;
export type UpdateOrderStatusParams = FromSchema<typeof updateOrderStatusSchema.params>;
export type UpdateOrderStatusBody = FromSchema<typeof updateOrderStatusSchema.body>;

// Database types (re-exported from schema)
export type { Order, NewOrder, OrderItem, NewOrderItem, OrderStatus } from '../db/schema.js';

// Export schemas
export { createOrderSchema, getOrderSchema, updateOrderStatusSchema } from './schemas.js';
