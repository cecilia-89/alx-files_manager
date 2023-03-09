const fs = require('fs');
const fsP = require('fs/promises');
const { uuid } = require('uuidv4');
const mime = require('mime-types');
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
    if (userId) {
      let id = '';
      const user = await this.db.findUser({ _id: userId });
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
          const image = Buffer.from(file.data, 'base64');
          await fsP.writeFile(`${localPath}/${file.name}`, image);
        }
        newFile.localPath = localPath;
        const insertResult = await this.db.uploadFile(newFile);
        id = insertResult.insertedId;
        newFile.id = id;
        delete newFile.localPath;
        delete newFile._id;
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
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        const file = await this.db.findFile({ _id: id, userId: user.id });
        if (Object.keys(file).length > 0) {
          delete file.localPath;
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
      } else if (parentId === '0') {
        parentId = 0;
      }
      if (Object.keys(user).length > 0) {
        const size = 4;
        const files = await this.db.findFiles(user.id, parentId, page, size);
        return files;
      }
    }
    throw new Error('Unauthorized');
  }

  async putPublish(token, id) {
    if (!token || !id) {
      throw new Error('Internal Error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        let file = await this.db.findFile({ _id: id, userId: user.id });
        if (Object.keys(file).length > 0) {
          const filter = { _id: file.id, userId: user.id };
          await this.db.filePublish(filter);
          file = await this.db.findFile({ _id: id, userId: user.id });
          const responseFile = {
            id: file.id,
            userId: user.id,
            name: file.name,
            type: file.type,
            isPublic: file.isPublic,
            parentId: file.parentId,
          };
          return responseFile;
        }
        throw new Error('Not found');
      }
    }
    throw new Error('Unauthorzsed');
  }

  async putUnpublish(token, id) {
    if (!token || !id) {
      throw new Error('Internal Error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    if (userId) {
      const user = await this.db.findUser({ _id: userId });
      if (Object.keys(user).length > 0) {
        let file = await this.db.findFile({ _id: id, userId: user.id });
        if (Object.keys(file).length > 0) {
          const filter = { _id: file.id, userId: user.id };
          await this.db.fileUnpublish(filter);
          file = await this.db.findFile({ _id: id, userId: user.id });
          const responseFile = {
            id: file.id,
            userId: user.id,
            name: file.name,
            type: file.type,
            isPublic: file.isPublic,
            parentId: file.parentId,
          };
          return responseFile;
        }
        throw new Error('Not found');
      }
    }
    throw new Error('Unauthorized');
  }

  async getFile(token, id, size) {
    if (!id) {
      throw new Error('Internal error');
    }
    const userId = await this.redis.get(`auth_${token}`);
    const file = await this.db.findFile({ _id: id });
    if (Object.keys(file).length > 0) {
      const path = file.localPath;
      let data;
      let type;
      if (file.type === 'folder') {
        throw new Error("A folder doesn't have content");
      }
      if (!fs.existsSync(`${path}/${file.name}`)) {
        throw new Error('Not found');
      }
      const sizes = ['500', '250', '100'];
      let width = '';
      if (size !== '' && sizes.includes(size) && file.type === 'image') {
        width = `_${size}`;
      }
      const splitName = file.name.split('.');
      let name;
      if (file.isPublic) {
        if (file.type === 'image') {
          data = await fsP.readFile(`${path}/${splitName[0]}${width}.${splitName[1]}`);
        } else {
          data = await fsP.readFile(`${path}/${splitName[0]}${width}.${splitName[1]}`, { encoding: 'utf-8' });
        }
        name = `${splitName[0]}${width}.${splitName[1]}`;
        type = mime.lookup(name);
        return { data, type };
      } if (userId) {
        const user = await this.db.findUser({ _id: userId });
        if (Object.keys(user).length > 0) {
          if (file.type === 'image') {
            data = await fsP.readFile(`${path}/${splitName[0]}${width}.${splitName[1]}`);
          } else {
            data = await fsP.readFile(`${path}/${splitName[0]}${width}.${splitName[1]}`, { encoding: 'utf-8' });
          }
          name = `${splitName[0]}${width}.${splitName[1]}`;
          type = mime.lookup(name);
          return { data, type };
        }
      } else {
        throw new Error('Unauthorized');
      }
    } else {
      throw new Error('Not found');
    }
    throw new Error('Unauthorized');
  }
}

const filescontroller = new FilesController();
module.exports = filescontroller;
