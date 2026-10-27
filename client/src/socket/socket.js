import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
});

export const connectSocket = () => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => socket.disconnect();