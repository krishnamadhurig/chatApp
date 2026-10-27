const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { signAvatar } = require('../services/userService');


const signup = asyncHandler(async (req, res) => {
  const data = await authService.signup(req.body);
  data.user = await signAvatar(data.user);
  res.status(201).json({ success: true, data });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  data.user = await signAvatar(data.user);
  res.json({ success: true, data });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: await signAvatar(req.user) } });
});

module.exports = { signup, login, me };