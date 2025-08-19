import { pgTable, text, timestamp, decimal, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const orderStatusEnum = ['Pending Shipment', 'Shipped', 'Delivered'] as const;
export type OrderStatus = typeof orderStatusEnum[number];

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  customerEmail: text('customer_email').notNull(),
  status: text('status').$type<OrderStatus>().notNull().default('Pending Shipment'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  shippingAddress: text('shipping_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
});

// Relations
export const ordersRelations = relations(orders, ({ many }) => ({
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
