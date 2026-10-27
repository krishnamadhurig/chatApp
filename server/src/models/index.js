const sequelize = require('../config/database');
const User = require('./User');
const Conversation = require('./Conversation');
const ConversationMember = require('./ConversationMember');
const Message = require('./Message');
const ReadMarker = require('./ReadMarker');


User.belongsToMany(Conversation, {
  through: ConversationMember,
  foreignKey: 'userId',
  otherKey: 'conversationId',
  as: 'conversations',
});
Conversation.belongsToMany(User, {
  through: ConversationMember,
  foreignKey: 'conversationId',
  otherKey: 'userId',
  as: 'members',
});

Conversation.hasMany(ConversationMember, {
  foreignKey: 'conversationId',
  as: 'memberships',
  onDelete: 'CASCADE',
});
ConversationMember.belongsTo(Conversation, { foreignKey: 'conversationId' });
ConversationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages',
  onDelete: 'CASCADE',
});
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

Conversation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Conversation.hasMany(ReadMarker, {
  foreignKey: 'conversationId',
  as: 'readMarkers',
  onDelete: 'CASCADE',
});
ReadMarker.belongsTo(Conversation, { foreignKey: 'conversationId' });
ReadMarker.belongsTo(User, { foreignKey: 'userId' });



module.exports = {
  sequelize,
  User,
  Conversation,
  ConversationMember,
  Message,
  ReadMarker
};