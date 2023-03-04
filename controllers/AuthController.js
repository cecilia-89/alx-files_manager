const crypto = require('crypto');
const { uuid } = require('uuidv4');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AuthController {
  constructor() {
    this.db = dbClient;
    this.redis = redisClient;
  }

  async getConnect(email, password) {
    if (!email || !password) {
      throw new Error('Internal error');
    }
    const user = await this.db.findUser({ email });
    if (user.length === 1) {
      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
      if (hashedPassword === user[0].password) {
        const token = uuid();
        this.redis.set(`auth_${token}`, user[0]._id.toString(), 60 * 60 * 24);
        return token;
      }
    }
    throw new Error('Unauthorized');
  }

  async getDisconnect(token) {
    if (!token) {
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        await this.redis.del(`auth_${token}`);
        return;
      }
    }
    throw new Error('Unauthorized');
  }
}

const authcontroller = new AuthController();
module.exports = authcontroller;
