#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const config = require('../src/config');
const logger = require('../src/utils/logger');

// Parse database URL
const dbConfig = parse(config.database.url);

// Create a pool for running migrations
const pool = new Pool({
  user: dbConfig.user || process.env.DB_USER,
  password: dbConfig.password || process.env.DB_PASSWORD,
  host: dbConfig.host || 'localhost',
  port: dbConfig.port || 5432,
  database: dbConfig.database || 'sales_service',
  ssl: dbConfig.ssl || false,
});

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const MIGRATION_TABLE = 'migrations';

/**
 * Ensure the migrations table exists
 */
async function ensureMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

/**
 * Get the list of applied migrations
 */
async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable();
    const result = await client.query(
      `SELECT name FROM ${MIGRATION_TABLE} ORDER BY name`
    );
    return result.rows.map(row => row.name);
  } finally {
    client.release();
  }
}

/**
 * Get the list of migration files
 */
async function getMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter(file => file.endsWith('.up.sql') || file.endsWith('.down.sql'))
    .sort();
}

/**
 * Apply a migration
 */
async function applyMigration(file) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read and execute the migration file
    const migrationPath = path.join(MIGRATIONS_DIR, file);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    logger.info(`Applying migration: ${file}`);
    await client.query(migrationSQL);

    // Record the migration
    if (file.endsWith('.up.sql')) {
      const migrationName = file.replace('.up.sql', '');
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1)`,
        [migrationName]
      );
    } else if (file.endsWith('.down.sql')) {
      const migrationName = file.replace('.down.sql', '');
      await client.query(
        `DELETE FROM ${MIGRATION_TABLE} WHERE name = $1`,
        [migrationName]
      );
    }

    await client.query('COMMIT');
    logger.info(`Successfully applied migration: ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error applying migration ${file}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run pending migrations
 */
async function migrate() {
  try {
    const appliedMigrations = new Set(await getAppliedMigrations());
    const allMigrations = await getMigrationFiles();

    // Only consider .up.sql files that haven't been applied
    const pendingMigrations = allMigrations
      .filter(file => file.endsWith('.up.sql'))
      .filter(file => !appliedMigrations.has(file.replace('.up.sql', '')));

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to apply');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    logger.info('All migrations applied successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Rollback the last applied migration
 */
async function rollback() {
  try {
    const appliedMigrations = await getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    const rollbackFile = `${lastMigration}.down.sql`;

    // Check if rollback file exists
    try {
      await fs.access(path.join(MIGRATIONS_DIR, rollbackFile));
    } catch {
      logger.warn(`No rollback file found for migration: ${lastMigration}`);
      return;
    }

    logger.info(`Rolling back migration: ${lastMigration}`);
    await applyMigration(rollbackFile);
    logger.info(`Successfully rolled back migration: ${lastMigration}`);
  } catch (error) {
    logger.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle command line arguments
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'up':
      await migrate();
      break;
    case 'down':
      await rollback();
      break;
    case 'status':
      const appliedMigrations = await getAppliedMigrations();
      console.log('Applied migrations:');
      appliedMigrations.forEach(m => console.log(`- ${m}`));
      break;
    default:
      console.log('Usage: node scripts/run-migration.js [up|down|status]');
      process.exit(1);
  }

  process.exit(0);
}

// Run the migration script
main().catch(error => {
  logger.error('Migration script failed:', error);
  process.exit(1);
});
