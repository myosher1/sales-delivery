import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_db';

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.log('Running migrations...');
  
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  
  console.log('Migrations completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
