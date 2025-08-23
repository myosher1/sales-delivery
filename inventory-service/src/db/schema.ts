// src/db/schema.ts
import { pgTable, serial, varchar, timestamp, integer, text, decimal } from 'drizzle-orm/pg-core';

// Products table for inventory management
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  category: text('category'),
  isActive: integer('is_active').notNull().default(1), // 1 = active, 0 = inactive
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Stock movements table for audit trail
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  movementType: varchar('movement_type', { length: 20 }).notNull(), // 'IN', 'OUT', 'ADJUSTMENT'
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason'),
  orderId: text('order_id'), // Reference to order if movement is due to order
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
