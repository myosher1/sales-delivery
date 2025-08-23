import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';

export const inventoryService = {
  // Check product availability for multiple items
  async checkAvailability(items: Array<{ productId: string; quantity: number }>) {
    const availabilityResults = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId)
      });

      if (!product) {
        availabilityResults.push({
          productId: item.productId,
          available: false,
          reason: 'Product not found'
        });
        continue;
      }

      if (product.isActive !== 1) {
        availabilityResults.push({
          productId: item.productId,
          productName: product.name,
          available: false,
          reason: 'Product is not active'
        });
        continue;
      }

      if (product.stockQuantity < item.quantity) {
        availabilityResults.push({
          productId: item.productId,
          productName: product.name,
          requested: item.quantity,
          currentStock: product.stockQuantity,
          available: false,
          reason: 'Insufficient stock'
        });
        continue;
      }

      availabilityResults.push({
        productId: item.productId,
        productName: product.name,
        requested: item.quantity,
        currentStock: product.stockQuantity,
        available: true
      });
    }

    return availabilityResults;
  },

  // Reserve stock for an order (decrease stock quantities)
  async reserveStock(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const reservationResults = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId)
      });

      if (!product || product.stockQuantity < item.quantity) {
        throw new Error(`Cannot reserve stock for product ${item.productId}: insufficient stock`);
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock - item.quantity;

      // Update product stock
      await db.update(products)
        .set({
          stockQuantity: newStock,
          updatedAt: new Date()
        })
        .where(eq(products.id, item.productId));

      // Record stock movement
      await db.insert(stockMovements).values({
        productId: item.productId,
        movementType: 'OUT',
        quantity: -item.quantity,
        previousStock,
        newStock,
        reason: 'Stock reserved for order',
        orderId
      });

      reservationResults.push({
        productId: item.productId,
        quantityReserved: item.quantity,
        previousStock,
        newStock
      });
    }

    return reservationResults;
  },

  // Release reserved stock (increase stock quantities) - for order cancellations
  async releaseStock(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const releaseResults = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId)
      });

      if (!product) {
        throw new Error(`Cannot release stock for product ${item.productId}: product not found`);
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock + item.quantity;

      // Update product stock
      await db.update(products)
        .set({
          stockQuantity: newStock,
          updatedAt: new Date()
        })
        .where(eq(products.id, item.productId));

      // Record stock movement
      await db.insert(stockMovements).values({
        productId: item.productId,
        movementType: 'IN',
        quantity: item.quantity,
        previousStock,
        newStock,
        reason: 'Stock released from cancelled order',
        orderId
      });

      releaseResults.push({
        productId: item.productId,
        quantityReleased: item.quantity,
        previousStock,
        newStock
      });
    }

    return releaseResults;
  },

  // Get product by ID
  async getProduct(productId: string) {
    return await db.query.products.findFirst({
      where: eq(products.id, productId)
    });
  },

  // List all products
  async listProducts() {
    return await db.select().from(products);
  },

  // Get stock movements for a product
  async getStockMovements(productId: string) {
    return await db.select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId))
      .orderBy(stockMovements.createdAt);
  }
};
