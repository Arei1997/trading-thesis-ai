import IORedis from 'ioredis';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set');
}

export const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
