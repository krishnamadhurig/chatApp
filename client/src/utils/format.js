export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatListTime = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(iso);
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export const previewText = (message) => {
  if (!message) return 'No messages yet';
  if (message.messageType === 'image') return 'Photo';
  if (message.messageType === 'file') return message.fileName || 'File';
  return message.message;
};