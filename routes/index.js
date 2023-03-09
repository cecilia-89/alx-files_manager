const { fileQueue } = require('../worker');
const { userQueue } = require('../worker');
const appcontroller = require('../controllers/AppController');
const userscontroller = require('../controllers/UsersController');
const authcontroller = require('../controllers/AuthController');
const filescontroller = require('../controllers/FilesController');

function routes(app) {
  app.get('/status', (req, res) => {
    const status = appcontroller.getStatus();
    res.send(status);
  });

  app.get('/stats', async (req, res) => {
    const stats = await appcontroller.getStats();
    res.send(stats);
  });

  app.post('/users', async (req, res) => {
    const userJson = req.body;
    if (!userJson || Object.keys(userJson).length === 0) {
      res.status(400);
      res.send({ Error: 'Missing credentials' });
    }
    if (!userJson.email) {
      res.status(400);
      res.send({ error: 'Missing email' });
    } else if (!userJson.password) {
      res.status(400);
      res.send({ error: 'Missing password' });
    } else {
      try {
        const newUser = await userscontroller.postNew(userJson);
        userQueue.add({ userId: newUser.id });
        res.send(newUser);
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else {
          res.status(400);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.get('/connect', async (req, res) => {
    let auth = req.header('Authorization');
    if (auth) {
      const sidx = auth.indexOf(' ');
      auth = Buffer.from(auth.slice(sidx + 1), 'base64').toString();
      const idx = auth.indexOf(':');
      const email = auth.slice(0, idx);
      const password = auth.slice(idx + 1);
      try {
        const token = await authcontroller.getConnect(email, password);
        res.send({ token });
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    } else {
      res.status(400);
      res.send({ error: 'Missing login credentials' });
    }
  });

  app.get('/disconnect', async (req, res) => {
    const token = req.header('X-Token');
    if (token) {
      try {
        await authcontroller.getDisconnect(token);
        res.status(204);
        res.send();
      } catch (err) {
        if (err) {
          if (err.toString() === 'Error: Internal error') {
            res.status(500);
          } else {
            res.status(401);
          }
          res.send({ error: err.toString().slice(7) });
        }
      }
    } else {
      res.status(400);
      res.send({ error: 'Missing token' });
    }
  });

  app.get('/users/me', async (req, res) => {
    const token = req.header('X-Token');
    if (token) {
      try {
        const user = await userscontroller.getMe(token);
        res.send(user);
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    } else {
      res.send(400);
      res.send({ Error: 'Missing Token' });
    }
  });

  app.post('/files', async (req, res) => {
    const token = req.header('X-Token');
    const fileJson = req.body;
    const validTypes = ['folder', 'file', 'image'];
    if (!token) {
      req.status(401);
      res.send({ Error: 'Missing token' });
      return;
    }
    if (!fileJson || Object.keys(fileJson).length === 0) {
      res.status(400);
      res.send({ Error: 'Missing credentials' });
      return;
    }
    if (!fileJson.name) {
      res.status(400);
      res.send({ Error: 'Missing name' });
      return;
    } if (!fileJson.type || !validTypes.includes(fileJson.type)) {
      res.status(400);
      res.send({ Error: 'Missing type' });
      return;
    } if (!fileJson.data && fileJson.type !== 'folder') {
      res.status(400);
      res.send({ Error: 'Missing data' });
      return;
    }
    if (fileJson.parentId) {
      try {
        const parent = await filescontroller.checkParent(fileJson.parentId);
        fileJson.parentId = parent.id;
      } catch (err) {
        res.status(400);
        res.send({ error: err.toString().slice(7) });
        return;
      }
    } else {
      fileJson.parentId = 0;
    }
    if (token) {
      try {
        const newFile = await filescontroller.postUpload(token, fileJson);
        if (newFile.type === 'image') {
          fileQueue.add({ userId: newFile.userId, fileId: newFile.id });
        }
        res.status(201);
        res.send(newFile);
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.param('id', (req, res, next, id) => {
    req.id = id;
    next();
  });

  app.get('/files/:id', async (req, res) => {
    const { id } = req;
    const token = req.header('X-Token');
    if (!token) {
      res.status(400);
      res.send({ Error: 'Missing token' });
      return;
    }
    if (token) {
      try {
        const file = await filescontroller.getShow(token, id);
        res.send(file);
      } catch (err) {
        if (err.toString() === 'Error: Not found') {
          res.status(404);
        } else if (err.toString() === 'Error: Internal Error') {
          res.status(500);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.get('/files', async (req, res) => {
    const parentId = req.query.parentId ? req.query.parentId : 0;
    const page = req.query.page ? req.query.page : 0;
    const token = req.header('X-Token');
    if (!token) {
      res.status(400);
      res.send({ Error: 'Missing token' });
    }
    if (token) {
      try {
        const files = await filescontroller.getIndex(token, parentId, page);
        res.send(files);
        return;
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.put('/files/:id/publish', async (req, res) => {
    const { id } = req;
    const token = req.header('X-Token');
    if (!token) {
      res.status(400);
      res.send({ Error: 'Missing token' });
    }
    if (token) {
      try {
        const response = await filescontroller.putPublish(token, id);
        res.send(response);
        return;
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else if (err.toString() === 'Error: Not found') {
          res.status(404);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.put('/files/:id/unpublish', async (req, res) => {
    const { id } = req;
    const token = req.header('X-Token');
    if (!token) {
      res.status(400);
      res.send({ Error: 'Missing token' });
    }
    if (token) {
      try {
        const response = await filescontroller.putUnpublish(token, id);
        res.send(response);
        return;
      } catch (err) {
        if (err.toString() === 'Error: Internal error') {
          res.status(500);
        } else if (err.toString() === 'Error: Not found') {
          res.status(404);
        } else {
          res.status(401);
        }
        res.send({ error: err.toString().slice(7) });
      }
    }
  });

  app.get('/files/:id/data', async (req, res) => {
    const token = req.header('X-Token');
    const { id } = req;
    const size = req.query.size ? req.query.size : '';

    try {
      const data = await filescontroller.getFile(token, id, size);
      res.setHeader('Content-type', data.type);
      if (data.type === 'image') {
        res.end(data.data, 'binary');
      }
      res.send(data.data);
    } catch (err) {
      if (err.toString() === 'Error: Internal error') {
        res.status(500);
      } else if (err.toString() === 'Error: Not found') {
        res.status(404);
      } else {
        res.status(400);
      }
      res.send({ error: err.toString().slice(7) });
    }
  });
}

module.exports = routes;
