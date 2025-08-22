import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema.js';

// Load environment variables
dotenv.config();

// Get the database URL from environment variables or use a default
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/delivery_db';

// Create a database connection
export const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Max idle time in seconds
  connect_timeout: 10, // Connection timeout in seconds
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Disable prepared statements for migrations
  prepare: false
});

// Create a Drizzle instance with the connection and schema
export const db = drizzle(client, { schema });
// Function to connect to the database
export const connectToDatabase = async () => {
    try {
        // Test the connection
        await client`SELECT 1`;
        console.log('✅ Connected to PostgreSQL database');
        return db;
    } catch (error) {
        console.error('❌ Failed to connect to PostgreSQL:', error);
        throw error;
    }
};

// Function to close the database connection
export const closeDatabase = async () => {
    await client.end();
    console.log('Database connection closed');
};

// Default export for backward compatibility
export default db;