import {FastifyPluginAsync} from "fastify";

export const helloRoute: FastifyPluginAsync = async (app) => {
    app.get('/hello', async (request, reply) => {
        return { hello: 'world' };
    });
};