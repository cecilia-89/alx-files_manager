import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.alive = true;
    this.client.on('error', (err) => {
      console.log(err.tostring());
      this.alive = false;
    });
    this.client.on('connect', () => {
      this.alive = true;
    });
  }

  isAlive() {
    return this.alive;
  }

  async get(key) {
    const value = await promisify(this.client.get).bind(this.client)(key);
    return value;
  }

  async set(key, value, duration) {
    await this.client.set(key, value, 'EX', duration);
  }

  async del(key) {
    await this.client.del(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
