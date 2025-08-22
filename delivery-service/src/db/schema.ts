// src/db/schema.ts
import { pgTable, serial, varchar, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

// Delivery status enum
export const deliveryStatusEnum = {
  PENDING: 'PENDING',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;

export const deliveries = pgTable('deliveries', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  customerId: integer('customer_id').notNull(),
  address: jsonb('address').notNull(),
  status: varchar('status', { length: 20 })
    .notNull()
    .$type<keyof typeof deliveryStatusEnum>()
    .default('PENDING'),
  estimatedDelivery: timestamp('estimated_delivery'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;