import { db } from './connection.js';
import { products } from './schema.js';
import { sql } from 'drizzle-orm';

const sampleProducts = [
  {
    id: 'prod-001',
    name: 'Wireless Bluetooth Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: '99.99',
    stockQuantity: 50,
    category: 'Electronics',
    isActive: 1
  },
  {
    id: 'prod-002',
    name: 'Smartphone Case',
    description: 'Protective case for smartphones',
    price: '19.99',
    stockQuantity: 100,
    category: 'Accessories',
    isActive: 1
  },
  {
    id: 'prod-003',
    name: 'USB-C Cable',
    description: 'Fast charging USB-C cable',
    price: '12.99',
    stockQuantity: 200,
    category: 'Accessories',
    isActive: 1
  },
  {
    id: 'prod-004',
    name: 'Laptop Stand',
    description: 'Adjustable aluminum laptop stand',
    price: '49.99',
    stockQuantity: 25,
    category: 'Office',
    isActive: 1
  },
  {
    id: 'prod-005',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    price: '29.99',
    stockQuantity: 75,
    category: 'Electronics',
    isActive: 1
  },
  {
    id: 'prod-006',
    name: 'Out of Stock Item',
    description: 'This item is currently out of stock',
    price: '39.99',
    stockQuantity: 0,
    category: 'Test',
    isActive: 1
  },
  {
    id: 'prod-007',
    name: 'Inactive Product',
    description: 'This product is inactive',
    price: '59.99',
    stockQuantity: 10,
    category: 'Test',
    isActive: 0
  }
];

const seedProducts = async () => {
  console.log('Starting to seed products...');

  try {
    // Clear existing products
    await db.delete(products);
    console.log('Cleared existing products');

    // Insert sample products
    await db.insert(products).values(sampleProducts);
    console.log(`Inserted ${sampleProducts.length} sample products`);

    // Display inserted products
    const insertedProducts = await db.select().from(products);
    console.log('\nInserted products:');
    insertedProducts.forEach(product => {
      console.log(`- ${product.id}: ${product.name} (Stock: ${product.stockQuantity}, Active: ${product.isActive})`);
    });

    console.log('\nProduct seeding completed successfully!');
    
    // Properly close the database connection
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

seedProducts();
