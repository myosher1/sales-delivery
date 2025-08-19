import Fastify from 'fastify';
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { helloRoute } from "./routes/hello.js";
import { ordersRoute } from "./routes/orders.js";

const fastify = Fastify({
  logger: true
});

const start = async () => {
  try {
    // Register routes
    await fastify.register(helloRoute);
    await fastify.register(ordersRoute);

    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Sales service is running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
