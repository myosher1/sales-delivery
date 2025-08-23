// src/db/schema.ts
import { pgTable, serial, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Delivery status enum
export const deliveryStatusEnum = {
  PENDING: 'PENDING',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;

export const deliveries = pgTable('deliveries', {
  id: serial('id').primaryKey(),
  orderId: varchar('order_id', { length: 255 }).notNull(),
  customerId: varchar('customer_id', { length: 255 }).notNull(),
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