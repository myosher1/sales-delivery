// src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({
    path: path.resolve(process.cwd(), '.env'),
});

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'RABBITMQ_URL', 'RABBITMQ_QUEUE'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Export configuration
export default {
    // Server
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    database: {
        url: process.env.DATABASE_URL!,
    },

    // RabbitMQ
    rabbitmq: {
        url: process.env.RABBITMQ_URL!,
        queue: process.env.RABBITMQ_QUEUE!,
    },

    // Add other configurations as needed
} as const;