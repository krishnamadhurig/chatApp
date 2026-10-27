const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    profileImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    isOnline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'Users',

    defaultScope: {
      attributes: {
        exclude: ['password'],
      },
    },

    scopes: {
      withPassword: {
        attributes: {},
      },
    },
  }
);

User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

User.prototype.checkPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;