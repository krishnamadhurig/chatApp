const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');

const search = asyncHandler(async (req, res) => {
  const users = await userService.searchUsers(req.user.id, req.query.search);
  res.json({ success: true, data: { users } });
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.json({ success: true, data: { user } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body, req.file);
  res.json({ success: true, data: { user } });
});

module.exports = { search, getById, updateProfile };