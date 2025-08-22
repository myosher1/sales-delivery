#!/bin/bash
set -e

echo "Starting database initialization..."

# Function to check if PostgreSQL is ready
wait_for_postgres() {
    local max_attempts=30
    local attempt=1

    echo "Waiting for PostgreSQL to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if psql --username "$POSTGRES_USER" --host "postgres" --dbname "$POSTGRES_DB" -c 'SELECT 1' >/dev/null 2>&1; then
            echo "PostgreSQL is ready!"
            return 0
        fi

        echo "PostgreSQL not ready yet, attempt $attempt/$max_attempts..."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo "Failed to connect to PostgreSQL after $max_attempts attempts"
    exit 1
}

# Wait for PostgreSQL to be ready
wait_for_postgres

# Create databases
echo "Creating databases..."
for dbname in ecommerce_db delivery_db; do
    echo "Creating database: $dbname"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE DATABASE "$dbname";
        GRANT ALL PRIVILEGES ON DATABASE "$dbname" TO "$POSTGRES_USER";
EOSQL
done

echo "Database initialization complete!"