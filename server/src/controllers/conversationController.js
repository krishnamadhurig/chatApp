const conversationService = require('../services/conversationService');
const asyncHandler = require('../utils/asyncHandler');
const { emitToUsers } = require('../socket/emitter');

const notifyUpdated = (userIds, conversationId) =>
  emitToUsers(userIds, 'conversation_updated', { conversationId });

const notifyRemoved = (userIds, conversationId) =>
  emitToUsers(userIds, 'conversation_removed', { conversationId });

const list = asyncHandler(async (req, res) => {
  const conversations = await conversationService.listForUser(req.user.id);
  res.json({ success: true, data: { conversations } });
});

const create = asyncHandler(async (req, res) => {
  if (req.body.type === 'group') {
    const { conversation, memberIds } = await conversationService.createGroup(
      req.user.id,
      req.body.name,
      req.body.memberIds
    );
    notifyUpdated(memberIds, conversation.id);
    return res.status(201).json({ success: true, data: { conversation } });
  }

  const { conversation, created } = await conversationService.createPrivate(
    req.user.id,
    req.body.userId
  );
  res.status(created ? 201 : 200).json({ success: true, data: { conversation } });
});

const getOne = asyncHandler(async (req, res) => {
  const conversation = await conversationService.getOne(req.params.id, req.user.id);
  res.json({ success: true, data: { conversation } });
});

const remove = asyncHandler(async (req, res) => {
  const { memberIds } = await conversationService.remove(req.params.id, req.user.id);
  notifyRemoved(memberIds, req.params.id);
  res.json({ success: true, data: { message: 'Conversation deleted' } });
});

const updateGroup = asyncHandler(async (req, res) => {
  const { conversation, memberIds } = await conversationService.updateGroup(
    req.params.id,
    req.user.id,
    req.body.name
  );
  notifyUpdated(memberIds, conversation.id);
  res.json({ success: true, data: { conversation } });
});

const setImage = asyncHandler(async (req, res) => {
  const { conversation, memberIds } = await conversationService.setGroupImage(
    req.params.id,
    req.user.id,
    req.file
  );
  notifyUpdated(memberIds, conversation.id);
  res.json({ success: true, data: { conversation } });
});

const addMembers = asyncHandler(async (req, res) => {
  const { conversation, memberIds } = await conversationService.addMembers(
    req.params.id,
    req.user.id,
    req.body.userIds
  );
  notifyUpdated(memberIds, conversation.id);
  res.json({ success: true, data: { conversation } });
});

const removeMember = asyncHandler(async (req, res) => {
  const { conversation, memberIds, removedId } = await conversationService.removeMember(
    req.params.id,
    req.user.id,
    req.params.userId
  );
  notifyRemoved([removedId], conversation.id);
  notifyUpdated(memberIds, conversation.id);
  res.json({ success: true, data: { conversation } });
});

const leave = asyncHandler(async (req, res) => {
  const result = await conversationService.leaveGroup(req.params.id, req.user.id);
  notifyRemoved([req.user.id], req.params.id);
  if (!result.deleted) notifyUpdated(result.memberIds, req.params.id);
  res.json({
    success: true,
    data: { message: result.deleted ? 'Group deleted because it has no members' : 'You left the group' },
  });
});

module.exports = { list, create, getOne, remove, updateGroup, setImage, addMembers, removeMember, leave };