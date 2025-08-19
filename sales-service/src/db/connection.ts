import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ecommerce_db';

// Create postgres connection
const queryClient = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(queryClient, { schema });

export { schema };
