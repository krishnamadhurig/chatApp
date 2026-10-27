const { User } = require('../models');
const { getContactIds } = require('../services/conversationService');

const registerPresence = async (io, socket) => {
  const userId = socket.user.id;
  const room = `user:${userId}`;

  socket.join(room);

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(room).fetchSockets();
      if (remaining.length > 0) return;

      const lastSeen = new Date();
      await User.update({ isOnline: false, lastSeen }, { where: { id: userId } });

      const contactIds = await getContactIds(userId);
      contactIds.forEach((id) =>
        io.to(`user:${id}`).emit('user_offline', { userId, lastSeen })
      );
    } catch (err) {
      console.error(err);
    }
  });

  try {
    await User.update({ isOnline: true }, { where: { id: userId } });

    const contactIds = await getContactIds(userId);
    contactIds.forEach((id) => io.to(`user:${id}`).emit('user_online', { userId }));

    const online = await User.findAll({
      where: { id: contactIds, isOnline: true },
      attributes: ['id'],
    });
    socket.emit('online_users', online.map((u) => u.id));
  } catch (err) {
    console.error(err);
  }
};

module.exports = registerPresence;