const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const registerPresence = require('./presenceHandler');
const registerChat = require('./chatHandler');
const { setIo } = require('./emitter');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL },
  });

  
  setIo(io);

  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(payload.id);
      if (!user) return next(new Error('Account not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    registerPresence(io, socket);
    registerChat(io, socket);
  });

  return io;
};

module.exports = { initSocket };