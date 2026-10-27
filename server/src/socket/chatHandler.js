const ApiError = require('../utils/ApiError');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const { handle } = require('./utils');

const toId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, `Invalid ${label}`);
  return id;
};

const otherMembers = async (conversationId, userId) => {
  const ids = await conversationService.getMemberIds(conversationId);
  return ids.filter((id) => id !== userId);
};

const registerChat = (io, socket) => {
  const user = socket.user;

  socket.on(
    'send_message',
    handle(async ({ conversationId, message }) => {
      const id = toId(conversationId, 'conversation id');
      const text = typeof message === 'string' ? message.trim() : '';
      if (!text || text.length > 5000) {
        throw new ApiError(400, 'Message must be 1 to 5000 characters');
      }

      const saved = await messageService.createMessage(id, user.id, text);
      const payload = saved.toJSON();

      const others = await otherMembers(id, user.id);
      let delivered = false;
      for (const otherId of others) {
        io.to(`user:${otherId}`).emit('new_message', payload);
        const sockets = await io.in(`user:${otherId}`).fetchSockets();
        if (sockets.length > 0) delivered = true;
      }

      socket.to(`user:${user.id}`).emit('new_message', payload);

      return { message: payload, delivered };
    })
  );

  socket.on(
    'message_read',
    handle(async ({ conversationId }) => {
      const id = toId(conversationId, 'conversation id');
      const result = await messageService.markConversationRead(id, user.id);

      if (result.updated > 0) {
        const others = await otherMembers(id, user.id);
        others.forEach((otherId) =>
          io.to(`user:${otherId}`).emit('messages_read', {
            conversationId: id,
            readerId: user.id,
            lastReadMessageId: result.lastReadMessageId,
          })
        );
      }
      return result;
    })
  );
  const relayTyping = (event) =>
    handle(async ({ conversationId }) => {
      const id = toId(conversationId, 'conversation id');
      await conversationService.ensureMember(id, user.id);

      const others = await otherMembers(id, user.id);
      others.forEach((otherId) =>
        io.to(`user:${otherId}`).emit(event, {
          conversationId: id,
          userId: user.id,
          name: user.name,
        })
      );
      return {};
    });

  socket.on('typing_start', relayTyping('typing_start'));
  socket.on('typing_stop', relayTyping('typing_stop'));

  socket.on(
    'delete_message',
    handle(async ({ messageId }) => {
      const id = toId(messageId, 'message id');
      const result = await messageService.deleteMessage(id, user.id);

      const others = await otherMembers(result.conversationId, user.id);
      others.forEach((otherId) =>
        io.to(`user:${otherId}`).emit('message_deleted', result)
      );
      return result;
    })
  );
};

module.exports = registerChat;