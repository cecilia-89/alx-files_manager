const express = require('express');
const routes = require('./routes/index');

const app = express();
app.use(express.json({ limit: '50mb' }));

const port = process.env.PORT ? process.env.PORT : 5000;

routes(app);

app.listen(port, () => {
  console.log('Server running on port 5000');
});
