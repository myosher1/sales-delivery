// migrate.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import { client, db } from './connection.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('Running migrations...');
  
  try {
    // Run migrations from the compiled JavaScript in dist
    const migrationsFolder = path.join(__dirname, '../../drizzle');
    console.log('Using migrations folder:', migrationsFolder);
    
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await client.end();
  }
}

runMigrations().catch(console.error);