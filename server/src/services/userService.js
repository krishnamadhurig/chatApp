const { Op } = require('sequelize');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const storage = require('./storageService');
const { validateFile } = require('../utils/fileRules');

const PUBLIC_FIELDS = ['id', 'name', 'email', 'profileImage', 'isOnline', 'lastSeen'];

const signAvatar = async (user) => {
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  if (!plain.profileImage) return plain;
  try {
    plain.profileImage = await storage.getSignedMediaUrl(plain.profileImage);
  } catch {
    plain.profileImage = null; 
  }
  return plain;
};

const searchUsers = async (currentUserId, search) => {
  const term = typeof search === 'string' ? search.trim() : '';
  if (!term) return [];

  const safe = term.replace(/[\\%_]/g, '\\$&');

  const users = await User.findAll({
    where: {
      id: { [Op.ne]: currentUserId },
      [Op.or]: [
        { name: { [Op.like]: `%${safe}%` } },
        { email: { [Op.like]: `%${safe}%` } },
      ],
    },
    attributes: PUBLIC_FIELDS,
    order: [['name', 'ASC']],
    limit: 20,
  });
  return Promise.all(users.map(signAvatar));
};

const getUserById = async (id) => {
  const user = await User.findByPk(id, { attributes: PUBLIC_FIELDS });
  if (!user) throw new ApiError(404, 'User not found');
  return signAvatar(user);
};

const updateProfile = async (userId, { name }, file) => {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const changes = {};
  if (typeof name === 'string' && name.trim()) changes.name = name.trim();

  let uploaded = null;
  if (file) {
    const { ext, type, contentType } = validateFile(file);
    if (type !== 'image') throw new ApiError(400, 'The profile photo must be an image');
    uploaded = await storage.uploadFile({
      buffer: file.buffer,
      contentType,
      ext,
      folder: `avatars/${userId}`,
    });
    changes.profileImage = uploaded.url;
  }

  if (Object.keys(changes).length === 0) throw new ApiError(400, 'Nothing to update');

  const previous = user.profileImage;
  try {
    await user.update(changes);
  } catch (err) {
    if (uploaded) await storage.deleteObject(uploaded.url).catch(() => {});
    throw err;
  }
  if (uploaded && previous) storage.deleteObject(previous).catch(() => {});

  return signAvatar(user);
};

module.exports = { searchUsers, getUserById, updateProfile, signAvatar, PUBLIC_FIELDS };