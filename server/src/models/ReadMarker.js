const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReadMarker = sequelize.define(
  'ReadMarker',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    lastReadMessageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'ReadMarkers',
    indexes: [{ unique: true, fields: ['conversationId', 'userId'] }],
  }
);

module.exports = ReadMarker;