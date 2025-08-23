import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@postgres:5432/inventory_db';

// Create the connection
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export { schema };
