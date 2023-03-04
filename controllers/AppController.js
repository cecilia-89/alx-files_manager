const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class Appcontroller {
  constructor() {
    this.redis = redisClient;
    this.db = dbClient;
  }

  getStatus() {
    return {
      redis: this.redis.isAlive(),
      db: this.db.isAlive(),
    };
  }

  async getStats() {
    if (this.db.isAlive()) {
      const response = {
        users: await this.db.nbUsers(),
        files: await this.db.nbFiles(),
      };
      return response;
    }
    console.log('out');
    return {};
  }
}

const appcontroller = new Appcontroller();
module.exports = appcontroller;
