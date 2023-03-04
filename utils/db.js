import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST ? process.env.DB_HOST : 'localhost';
    const port = process.env.DB_PORT ? process.env.DB_PORT : '27017 ';
    const database = process.env.DB_DATABASE ? process.env.DB_DATABASE : 'files_manager';
    const url = `mongodb://${host}:${port}`;

    (async () => {
      const client = new MongoClient(url, { useUnifiedTopology: true });
      await client.connect();
      this.isConnected = true;
      this.db = await client.db(database);
    })()
      .then(this.isConnected = true)
      .catch(this.isConnected = false);
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    const usercount = await this.db.collection('users').countDocuments();
    return usercount;
  }

  async nbFiles() {
    const filecount = await this.db.collection('files').countDocuments();
    return filecount;
  }

  async uploadUser(user) {
    await this.db.collection('users').insertOne(user);
  }

  async uploadFile(file) {
    const response = await this.db.collection('files').insertOne(file);
    return response;
  }

  async findUser(filter) {
    let user;
    if (filter._id) {
      let usersFound = [];
      if (Object.keys(filter).length > 1) {
        const _filter = JSON.parse(JSON.stringify(filter));
        delete _filter._id;
        usersFound = await this.db.collection('users').find(_filter).toArray();
      } else {
        usersFound = await this.db.collection('users').find({}).toArray();
      }
      user = usersFound.filter((value) => filter._id === value._id.toString());
      if (user.length === 1) {
        user[0].id = user[0]._id;
        delete user[0]._id;
        return user[0];
      }
      return {};
    }
    user = await this.db.collection('users').find(filter).toArray();
    return user;
  }

  async findFile(filter) {
    let file;
    if (filter._id) {
      let filesFound = [];
      if (Object.keys(filter).length > 1) {
        const _filter = JSON.parse(JSON.stringify(filter));
        delete _filter._id;
        filesFound = await this.db.collection('files').find(_filter).toArray();
      } else {
        filesFound = await this.db.collection('files').find({}).toArray();
      }
      file = filesFound.filter((value) => filter._id === value._id.toString());
      if (file.length === 1) {
        file[0].id = file[0]._id;
        delete file[0]._id;
        return file[0];
      }
      return {};
    }
    file = await this.db.collection('files').find(filter).toArray();
    return file;
  }

  async findFiles(userId, parentId, page, size) {
    console.log(userId, parentId, page, size);
    let files = await this.db.collection('files').aggregate([
      { $match: { userId, parentId } },
      { $sort: { type: 1, name: 1 } },
      { $skip: page * size },
      { $set: { id: '$_id' } },
      { $limit: size },
      { $project: { _id: 0, localPath: 0 } }]);
    console.log(await files.toArray());
    files = await files.toArray();
    return files;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
