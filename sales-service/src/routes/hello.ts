import {FastifyPluginAsync} from "fastify";

export const helloRoute: FastifyPluginAsync = async (app) => {
    app.get('/hello', async (request, reply) => {
        return { hello: 'world' };
    });

    // Health check endpoint
    app.get('/health', async (request, reply) => {
        return { 
            status: 'healthy',
            service: 'sales-service',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
    });
};