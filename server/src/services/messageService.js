const { Op } = require('sequelize');
const { User, Message, ReadMarker } = require('../models');
const ApiError = require('../utils/ApiError');
const { ensureMember } = require('./conversationService');
const storage = require('./storageService');
const { validateFile, displayName } = require('../utils/fileRules');


const senderInclude = {
  model: User,
  as: 'sender',
  attributes: ['id', 'name', 'profileImage'],
};

const loadWithSender = (id) => Message.findByPk(id, { include: [senderInclude] });

const toClient = async (message) => {
  const json = message.toJSON();
  if (json.mediaUrl) {
    try {
      json.mediaUrl = await storage.getSignedMediaUrl(json.mediaUrl, {
        fileName: json.fileName,
        download: json.messageType === 'file',
      });
    } catch (err) {
      console.error('Could not sign media URL:', err.message);
      json.mediaUrl = null;
    }
  }
  return json;
};


const getMessages = async (conversationId, userId, page = 1, limit = 20) => {
  await ensureMember(conversationId, userId);

  page = Number(page) || 1;
  limit = Number(limit) || 20;

  const offset = (page - 1) * limit;

  const { rows, count } = await Message.findAndCountAll({
    where: { conversationId },
    include: [senderInclude],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });

  return {
    messages: await Promise.all(rows.reverse().map(toClient)),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const createMessage = async (conversationId, senderId, text) => {
  await ensureMember(conversationId, senderId);

  const created = await Message.create({
    conversationId,
    senderId,
    message: text,
    messageType: 'text',
  });

  return loadWithSender(created.id);
};

const findForMember = async (messageId, userId) => {
  const message = await Message.findByPk(messageId);
  if (!message) throw new ApiError(404, 'Message not found');
  const conversation = await ensureMember(message.conversationId, userId);
  return { message, conversation };
};

const markRead = async (messageId, userId) => {
  const { message, conversation } = await findForMember(messageId, userId);
  if (message.senderId === userId) {
    throw new ApiError(400, 'You cannot mark your own message as read');
  }

  if (conversation.type === 'group') {
    const [marker] = await ReadMarker.findOrCreate({
      where: { conversationId: message.conversationId, userId },
      defaults: { lastReadMessageId: message.id },
    });
    if (marker.lastReadMessageId < message.id) {
      await marker.update({ lastReadMessageId: message.id });
    }
  } else if (!message.isRead) {
    await message.update({ isRead: true });
  }
  return message;
};

const markConversationRead = async (conversationId, userId) => {
  const conversation = await ensureMember(conversationId, userId);

  if (conversation.type === 'group') {
    const latest = (await Message.max('id', { where: { conversationId } })) || 0;
    const [marker, created] = await ReadMarker.findOrCreate({
      where: { conversationId, userId },
      defaults: { lastReadMessageId: latest },
    });
    if (created) return { updated: 1, lastReadMessageId: latest };
    if (marker.lastReadMessageId >= latest) {
      return { updated: 0, lastReadMessageId: marker.lastReadMessageId };
    }
    await marker.update({ lastReadMessageId: latest });
    return { updated: 1, lastReadMessageId: latest };
  }

  const [updated] = await Message.update(
    { isRead: true },
    {
      where: {
        conversationId,
        senderId: { [Op.ne]: userId },
        isRead: false,
      },
    }
  );
  return { updated, lastReadMessageId: null };
};

const createMediaMessage = async (conversationId, senderId, file) => {
  await ensureMember(conversationId, senderId);
  if (!file) throw new ApiError(400, 'Choose a file to upload');

  const { ext, type, contentType } = validateFile(file);
  const uploaded = await storage.uploadFile({
    buffer: file.buffer,
    contentType,
    ext,
    folder: `chat/${conversationId}`,
  });

  let created;
  try {
    created = await Message.create({
      conversationId,
      senderId,
      messageType: type,
      mediaUrl: uploaded.url,
      fileName: displayName(file.originalname),
    });
  } catch (err) {
    await storage.deleteObject(uploaded.url).catch(() => {});
    throw err;
  }

  return toClient(await loadWithSender(created.id));
};

const deleteMessage = async (messageId, userId) => {
  const message = await Message.findByPk(messageId);
  if (!message) throw new ApiError(404, 'Message not found');
  if (message.senderId !== userId) {
    throw new ApiError(403, 'You can only delete your own messages');
  }

  const { id, conversationId, mediaUrl } = message;
  await message.destroy();
  if (mediaUrl) {
    storage.deleteObject(mediaUrl).catch((err) => console.error('S3 delete failed:', err.message));
  }
  return { id, conversationId };
};
module.exports = {
  getMessages,
  createMessage,
  markRead,
  markConversationRead,
  deleteMessage,
  createMediaMessage
};