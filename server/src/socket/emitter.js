let io = null;

const setIo = (instance) => {
  io = instance;
};

const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  userIds.forEach((id) => io.to(`user:${id}`).emit(event, payload));
};

const isUserConnected = async (userId) => {
  if (!io) return false;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
};

module.exports = { setIo, emitToUsers, isUserConnected };