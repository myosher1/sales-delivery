import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@postgres:5432/delivery_db';

// Wait for PostgreSQL to be ready
async function waitForDatabase(maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const testClient = postgres(connectionString, { max: 1 });
            await testClient`SELECT 1`;
            await testClient.end();
            console.log('Database is ready!');
            return;
        } catch (error) {
            console.log(`[Database not ready, attempt ${attempt}/${maxAttempts}. Waiting...](cci:1://file:///Users/michaelyosher/WebstormProjects/my_shop/sales-service/migrate.js:23:0-37:1)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Database not ready after maximum attempts');
}

async function main() {
    console.log('Waiting for database to be ready...');
    await waitForDatabase();

    console.log('Running migrations...');

    const migrationClient = postgres(connectionString, { max: 1 });
    const db = drizzle(migrationClient);

    await migrate(db, { migrationsFolder: './src/db/migrations' });

    console.log('Migrations completed!');
    await migrationClient.end();
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed!', err);
    process.exit(1);
});