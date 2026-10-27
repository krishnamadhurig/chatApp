const messageService = require('../services/messageService');
const asyncHandler = require('../utils/asyncHandler');

const conversationService = require('../services/conversationService');
const { emitToUsers, isUserConnected } = require('../socket/emitter');


const list = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const data = await messageService.getMessages(
    req.params.conversationId,
    req.user.id,
    page,
    limit
  );
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const message = await messageService.createMessage(
    req.params.conversationId,
    req.user.id,
    req.body.message
  );
  res.status(201).json({ success: true, data: { message } });
});

const markRead = asyncHandler(async (req, res) => {
  const message = await messageService.markRead(req.params.id, req.user.id);
  res.json({ success: true, data: { message } });
});

const markConversationRead = asyncHandler(async (req, res) => {
  const updated = await messageService.markConversationRead(
    req.params.conversationId,
    req.user.id
  );
  res.json({ success: true, data: { updated } });
});

const remove = asyncHandler(async (req, res) => {
  const data = await messageService.deleteMessage(req.params.id, req.user.id);
  res.json({ success: true, data });
});

const upload = asyncHandler(async (req, res) => {
  const message = await messageService.createMediaMessage(
    req.params.conversationId,
    req.user.id,
    req.file
  );

  const memberIds = await conversationService.getMemberIds(message.conversationId);
  emitToUsers(memberIds, 'new_message', message);

  const others = memberIds.filter((id) => id !== req.user.id);
  const delivered = (await Promise.all(others.map(isUserConnected))).some(Boolean);

  res.status(201).json({ success: true, data: { message, delivered } });
});

module.exports = { list, create, markRead, markConversationRead, remove, upload };