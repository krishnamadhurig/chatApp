const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const createToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const signup = async ({ name, email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new ApiError(409, 'Email is already registered');

  const user = await User.create({ name, email, password });
  return { user, token: createToken(user.id) };
};

const login = async ({ email, password }) => {
  const user = await User.scope('withPassword').findOne({ where: { email } });

  if (!user || !(await user.checkPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return { user, token: createToken(user.id) };
};

module.exports = { signup, login, createToken };