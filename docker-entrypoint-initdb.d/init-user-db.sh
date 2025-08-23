#!/bin/bash
set -e

echo "Starting database initialization..."

# Create databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE ecommerce_db;
    CREATE DATABASE delivery_db;
    CREATE DATABASE inventory_db;
    GRANT ALL PRIVILEGES ON DATABASE ecommerce_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE delivery_db TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE inventory_db TO $POSTGRES_USER;
EOSQL

echo "Database initialization completed successfully!"
echo "Created databases: ecommerce_db, delivery_db, inventory_db"