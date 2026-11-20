const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT || 6379),
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('Redis bağlantısı başarılı.');
});

redis.on('error', (err) => {
  console.error('Redis bağlantı hatası:', err.message);
});

module.exports = redis;
