require('dotenv').config();
const http = require('http');
const app = require('./app');
const { sequelize, User } = require('./models');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected');

    await sequelize.sync();
    console.log('Tables are ready');

    await User.update({ isOnline: false }, { where: {} });

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

start();