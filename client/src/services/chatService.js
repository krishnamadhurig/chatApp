import api from './api';

export const fetchConversations = () => api.get('/conversations');
export const startConversation = (userId) => api.post('/conversations', { userId });
export const searchUsers = (search) => api.get('/users', { params: { search } });
export const fetchMessages = (conversationId, page = 1, limit = 20) =>
  api.get(`/conversations/${conversationId}/messages`, { params: { page, limit } });

export const sendMedia = (conversationId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/conversations/${conversationId}/media`, form);
};

export const createGroup = (name, memberIds) =>
  api.post('/conversations', { type: 'group', name, memberIds });

export const renameGroup = (id, name) => api.put(`/conversations/${id}`, { name });

export const setGroupImage = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.put(`/conversations/${id}/image`, form);
};

export const addGroupMembers = (id, userIds) =>
  api.post(`/conversations/${id}/members`, { userIds });

export const removeGroupMember = (id, userId) =>
  api.delete(`/conversations/${id}/members/${userId}`);

export const leaveGroup = (id) => api.post(`/conversations/${id}/leave`);

export const deleteConversation = (id) => api.delete(`/conversations/${id}`);

export const updateProfile = ({ name, file }) => {
  const form = new FormData();
  if (name) form.append('name', name);
  if (file) form.append('file', file);
  return api.put('/users/profile', form);
};