const crypto = require('crypto');
const dbClient = require('../utils/db');
const redisclient = require('../utils/redis');

class UsersController {
  constructor() {
    this.db = dbClient;
    this.redis = redisclient;
  }

  async postNew(User) {
    const user = User;
    if (!user || Object.keys(user).length === 0) {
      throw new Error('Internal error');
    }
    const email = { email: user.email };
    const users = await this.db.findUser(email);
    if (users.length > 0) {
      throw new Error('Already exist');
    } else {
      user.password = crypto.createHash('sha1').update(user.password).digest('hex');
      const insertResult = await this.db.uploadUser(user);
      const id = insertResult.insertedId.toString();
      return {
        id,
        email: user.email,
      };
    }
  }

  async getMe(token) {
    if (!token) {
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        return {
          id: user.id,
          email: user.email,
        };
      }
    }
    throw new Error('Unauthorized');
  }
}

const userscontroller = new UsersController();
module.exports = userscontroller;
