const { Op } = require('sequelize');
const { sequelize, User, Conversation, ConversationMember, Message, ReadMarker } = require('../models');
const ApiError = require('../utils/ApiError');
const { PUBLIC_FIELDS, signAvatar } = require('./userService');
const storage = require('./storageService');
const { validateFile } = require('../utils/fileRules');

const MAX_MEMBERS = 50;

const logS3 = (err) => console.error('S3 delete failed:', err.message);

const memberInclude = {
  model: User,
  as: 'members',
  attributes: PUBLIC_FIELDS,
  through: { attributes: [] },
};

const loadFull = (id) => Conversation.findByPk(id, { include: [memberInclude] });

const ensureMember = async (conversationId, userId) => {
  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const membership = await ConversationMember.findOne({ where: { conversationId, userId } });
  if (!membership) throw new ApiError(403, 'You are not part of this conversation');

  return conversation;
};

const ensureCreator = async (conversationId, userId) => {
  const conversation = await ensureMember(conversationId, userId);
  if (conversation.type !== 'group') throw new ApiError(400, 'This is not a group conversation');
  if (conversation.createdBy !== userId) throw new ApiError(403, 'Only the group creator can do this');
  return conversation;
};

const getMemberIds = async (conversationId) => {
  const rows = await ConversationMember.findAll({
    where: { conversationId },
    attributes: ['userId'],
  });
  return rows.map((r) => r.userId);
};

const getContactIds = async (userId) => {
  const mine = await ConversationMember.findAll({
    where: { userId },
    attributes: ['conversationId'],
  });
  const conversationIds = mine.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const others = await ConversationMember.findAll({
    where: { conversationId: conversationIds, userId: { [Op.ne]: userId } },
    attributes: ['userId'],
  });
  return [...new Set(others.map((o) => o.userId))];
};

const format = async (conversation, currentUserId) => {
  const members = await Promise.all(conversation.members.map((m) => signAvatar(m)));

  const isGroup = conversation.type === 'group';
  const other = isGroup ? null : members.find((m) => m.id !== currentUserId) || null;

  const readMarks = {};
  if (isGroup) {
    const markers = await ReadMarker.findAll({ where: { conversationId: conversation.id } });
    markers.forEach((m) => {
      readMarks[m.userId] = m.lastReadMessageId;
    });
  }

  const unreadWhere = { conversationId: conversation.id, senderId: { [Op.ne]: currentUserId } };
  if (isGroup) unreadWhere.id = { [Op.gt]: readMarks[currentUserId] || 0 };
  else unreadWhere.isRead = false;

  const [lastMessage, unreadCount, groupImage] = await Promise.all([
    Message.findOne({
      where: { conversationId: conversation.id },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    }),
    Message.count({ where: unreadWhere }),
    isGroup && conversation.groupImage
      ? storage.getSignedMediaUrl(conversation.groupImage).catch(() => null)
      : null,
  ]);

  return {
    id: conversation.id,
    type: conversation.type,
    name: other ? other.name : conversation.name,
    image: other ? other.profileImage : groupImage,
    createdBy: conversation.createdBy,
    members,
    otherUser: other,
    lastMessage,
    unreadCount,
    readMarks: isGroup ? readMarks : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const afterChange = async (conversationId, actorId) => {
  const full = await loadFull(conversationId);
  return {
    conversation: await format(full, actorId),
    memberIds: full.members.map((m) => m.id),
  };
};

const privateKeyFor = (a, b) => [a, b].sort((x, y) => x - y).join('_');

const createPrivate = async (currentUserId, otherUserId) => {
  if (currentUserId === otherUserId) throw new ApiError(400, 'You cannot chat with yourself');

  const other = await User.findByPk(otherUserId);
  if (!other) throw new ApiError(404, 'User not found');

  const key = privateKeyFor(currentUserId, otherUserId);
  let conversation = await Conversation.findOne({ where: { privateKey: key } });
  let created = false;

  if (!conversation) {
    try {
      conversation = await sequelize.transaction(async (t) => {
        const c = await Conversation.create(
          { type: 'private', createdBy: currentUserId, privateKey: key },
          { transaction: t }
        );
        await ConversationMember.bulkCreate(
          [
            { conversationId: c.id, userId: currentUserId },
            { conversationId: c.id, userId: otherUserId },
          ],
          { transaction: t }
        );
        return c;
      });
      created = true;
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      conversation = await Conversation.findOne({ where: { privateKey: key } });
    }
  }

  const full = await loadFull(conversation.id);
  return { conversation: await format(full, currentUserId), created };
};

const createGroup = async (creatorId, name, memberIds) => {
  const ids = [...new Set(memberIds)].filter((id) => id !== creatorId);
  if (ids.length < 1) throw new ApiError(400, 'Add at least one other member');
  if (ids.length + 1 > MAX_MEMBERS) {
    throw new ApiError(400, `A group can have at most ${MAX_MEMBERS} members`);
  }

  const found = await User.count({ where: { id: ids } });
  if (found !== ids.length) throw new ApiError(404, 'One or more users were not found');

  const everyone = [creatorId, ...ids];
  const conversation = await sequelize.transaction(async (t) => {
    const c = await Conversation.create(
      { type: 'group', name, createdBy: creatorId },
      { transaction: t }
    );
    await ConversationMember.bulkCreate(
      everyone.map((userId) => ({ conversationId: c.id, userId })),
      { transaction: t }
    );
    return c;
  });

  const result = await afterChange(conversation.id, creatorId);
  return result;
};

const updateGroup = async (conversationId, userId, name) => {
  const conversation = await ensureCreator(conversationId, userId);
  await conversation.update({ name });
  return afterChange(conversationId, userId);
};

const setGroupImage = async (conversationId, userId, file) => {
  const conversation = await ensureCreator(conversationId, userId);
  if (!file) throw new ApiError(400, 'Choose an image to upload');

  const { ext, type, contentType } = validateFile(file);
  if (type !== 'image') throw new ApiError(400, 'The group picture must be an image');

  const uploaded = await storage.uploadFile({
    buffer: file.buffer,
    contentType,
    ext,
    folder: `groups/${conversationId}`,
  });

  const previous = conversation.groupImage;
  try {
    await conversation.update({ groupImage: uploaded.url });
  } catch (err) {
    await storage.deleteObject(uploaded.url).catch(() => { });
    throw err;
  }
  if (previous) storage.deleteObject(previous).catch(logS3);

  return afterChange(conversationId, userId);
};

const addMembers = async (conversationId, userId, userIds) => {
  await ensureCreator(conversationId, userId);

  const existing = await getMemberIds(conversationId);
  const fresh = [...new Set(userIds)].filter((id) => !existing.includes(id));
  if (fresh.length === 0) throw new ApiError(409, 'Those users are already in the group');
  if (existing.length + fresh.length > MAX_MEMBERS) {
    throw new ApiError(400, `A group can have at most ${MAX_MEMBERS} members`);
  }

  const found = await User.count({ where: { id: fresh } });
  if (found !== fresh.length) throw new ApiError(404, 'One or more users were not found');

  const latest = (await Message.max('id', { where: { conversationId } })) || 0;

  await sequelize.transaction(async (t) => {
    await ConversationMember.bulkCreate(
      fresh.map((id) => ({ conversationId, userId: id })),
      { transaction: t }
    );
    await ReadMarker.bulkCreate(
      fresh.map((id) => ({ conversationId, userId: id, lastReadMessageId: latest })),
      { transaction: t }
    );
  });

  return afterChange(conversationId, userId);
};

const removeMember = async (conversationId, userId, targetId) => {
  await ensureCreator(conversationId, userId);
  if (targetId === userId) {
    throw new ApiError(400, 'Use "leave group" to leave a group you created');
  }

  const removed = await ConversationMember.destroy({ where: { conversationId, userId: targetId } });
  if (!removed) throw new ApiError(404, 'That user is not in this group');
  await ReadMarker.destroy({ where: { conversationId, userId: targetId } });

  const result = await afterChange(conversationId, userId);
  return { ...result, removedId: targetId };
};

const destroyWithMedia = async (conversation) => {
  const media = await Message.findAll({
    where: { conversationId: conversation.id, mediaUrl: { [Op.ne]: null } },
    attributes: ['mediaUrl'],
  });
  const urls = [...media.map((m) => m.mediaUrl), conversation.groupImage].filter(Boolean);

  await conversation.destroy();
  urls.forEach((url) => storage.deleteObject(url).catch(logS3));
};

const leaveGroup = async (conversationId, userId) => {
  const conversation = await ensureMember(conversationId, userId);
  if (conversation.type !== 'group') {
    throw new ApiError(400, 'You can only leave a group. Delete a private chat instead');
  }

  await ConversationMember.destroy({ where: { conversationId, userId } });
  await ReadMarker.destroy({ where: { conversationId, userId } });

  const remaining = await ConversationMember.findAll({
    where: { conversationId },
    order: [['joinedAt', 'ASC'], ['id', 'ASC']],
  });

  if (remaining.length === 0) {
    await destroyWithMedia(conversation);
    return { deleted: true, memberIds: [] };
  }

  if (conversation.createdBy === userId) {
    await conversation.update({ createdBy: remaining[0].userId });
  }
  return { deleted: false, memberIds: remaining.map((r) => r.userId) };
};

const listForUser = async (userId) => {
  const memberships = await ConversationMember.findAll({
    where: { userId },
    attributes: ['conversationId'],
  });
  const ids = memberships.map((m) => m.conversationId);
  if (ids.length === 0) return [];

  const conversations = await Conversation.findAll({
    where: { id: ids },
    include: [memberInclude],
  });
  const items = await Promise.all(conversations.map((c) => format(c, userId)));

  const time = (item) =>
    new Date(item.lastMessage ? item.lastMessage.createdAt : item.createdAt).getTime();
  return items.sort((a, b) => time(b) - time(a));
};

const getOne = async (conversationId, userId) => {
  await ensureMember(conversationId, userId);
  const full = await loadFull(conversationId);
  return format(full, userId);
};

const remove = async (conversationId, userId) => {
  const conversation = await ensureMember(conversationId, userId);
  if (conversation.type === 'group' && conversation.createdBy !== userId) {
    throw new ApiError(403, 'Only the group creator can delete this group');
  }

  const memberIds = await getMemberIds(conversationId);
  await destroyWithMedia(conversation);
  return { memberIds };
};

module.exports = {
  ensureMember,
  createPrivate,
  createGroup,
  updateGroup,
  setGroupImage,
  addMembers,
  removeMember,
  leaveGroup,
  listForUser,
  getOne,
  remove,
  getMemberIds,
  getContactIds,
};