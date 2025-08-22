import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string) => Promise<'OK'>;
      del: (key: string) => Promise<number>;
      on: (event: string, callback: (err?: Error) => void) => void;
      quit: () => Promise<void>;
    };
  }
}
