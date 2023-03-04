const fs = require('fs');
const fsP = require('fs/promises');
const { uuid } = require('uuidv4');
const imageThumbnail = require('image-thumbnail');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  constructor() {
    this.db = dbClient;
    this.redis = redisClient;
  }

  async postUpload(token, File) {
    const file = File;
    if (!token || !file || Object.keys(file).length === 0) {
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    console.log(token, file);
    console.log(userId);
    if (userId) {
      let id = '';
      const user = await this.db.findUser({ _id: userId });
      console.log(user);
      if (Object.keys(user).length > 0) {
        file.userId = user._id;
        if (!file.isPublic || file.isPublic !== true) {
          file.isPublic = false;
        }
        const newFile = {
          userId: user.id,
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId,
        };
        if (file.type === 'folder') {
          const insertResult = await this.db.uploadFile(newFile);
          id = insertResult.insertedId;
          newFile.id = id;
          delete newFile._id;
          return newFile;
        }
        const folderPath = process.env.FOLDER_PATH ? process.env.FOLDER_PATH : '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath);
        }
        const localPath = `${folderPath}/${uuid()}`;
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath);
        }
        if (file.type === 'file') {
          const content = Buffer.from(file.data, 'base64').toString();
          await fsP.writeFile(`${localPath}/${file.name}`, content);
        } else if (file.type === 'image') {
          const thumbnail = await imageThumbnail(file.data);
          await fsP.writeFile(`${localPath}/${file.name}`, thumbnail);
        }
        newFile.localPath = localPath;
        const insertResult = await this.db.uploadFile(newFile);
        id = insertResult.insertedId;
        newFile.id = id;
        delete newFile.localPath;
        delete newFile._id;
        console.log('created', newFile);
        return newFile;
      }
    }
    throw new Error('Unauthorized');
  }

  async checkParent(parentId) {
    if (!parentId && parentId !== 0) {
      throw new Error('Internal Error');
    }
    const parent = await this.db.findFile({ _id: parentId });
    console.log(parent);
    if (Object.keys(parent).length > 0) {
      if (parent.type !== 'folder') {
        throw new Error('Parent is not a folder');
      } else {
        return parent;
      }
    } else {
      throw new Error('Parent not found');
    }
  }

  async getShow(token, id) {
    if (!token || !id) {
      console.log('error internal');
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        const file = await this.db.findFile({ _id: id, userId: user.id });
        if (Object.keys(file).length > 0) {
          return file;
        }
        throw new Error('Not found');
      }
    }
    throw new Error('Unauthorised');
  }

  async getIndex(token, parentid, page) {
    let parentId = parentid;
    if (!token) {
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      const parent = await this.db.findFile({ _id: parentId });
      if (Object.keys(parent).length > 0) {
        parentId = parent.id;
      }
      if (Object.keys(user).length > 0) {
        const size = 4;
        const files = await this.db.findFiles(user.id, parentId, page, size);
        return files;
      }
    }
    throw new Error('Unauthorized');
  }
}

const filescontroller = new FilesController();
module.exports = filescontroller;
