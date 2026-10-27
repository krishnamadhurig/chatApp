import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { socket, connectSocket, disconnectSocket } from '../socket/socket';
import * as chatApi from '../services/chatService';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

const latestFirst = (a, b) => {
  const time = (c) => new Date(c.lastMessage ? c.lastMessage.createdAt : c.createdAt).getTime();
  return time(b) - time(a);
};

const addUnique = (list, message) =>
  list.some((m) => m.id === message.id) ? list : [...list, message];

const callApi = async (request, fallback) => {
  try {
    const res = await request();
    return res.data.data;
  } catch (err) {
    throw new Error((err.response && err.response.data && err.response.data.error) || fallback);
  }
};

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [threads, setThreads] = useState({});
  const [onlineIds, setOnlineIds] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

    const [typingMap, setTypingMap] = useState({});
  const [deliveredIds, setDeliveredIds] = useState({});
  const typingTimers = useRef({});

  const activeIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const threadsRef = useRef({});
  activeIdRef.current = activeId;
  conversationsRef.current = conversations;
  threadsRef.current = threads;

    const seedOnline = useCallback(
    (list) => {
      const ids = list.flatMap((c) =>
        c.members.filter((m) => m.isOnline && m.id !== user.id).map((m) => m.id)
      );
      if (ids.length) setOnlineIds((prev) => [...new Set([...prev, ...ids])]);
    },
    [user.id]
  );

  const refreshConversations = useCallback(async () => {
    try {
      const res = await chatApi.fetchConversations();
      const list = res.data.data.conversations;
      setConversations(list);
      seedOnline(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, [seedOnline]);

  const loadMessages = useCallback(async (conversationId, page = 1) => {
    const res = await chatApi.fetchMessages(conversationId, page);
    const { messages, pagination } = res.data.data;

    setThreads((prev) => {
      const old = (prev[conversationId] && prev[conversationId].items) || [];
      let items = messages;
      if (page > 1) {
        const known = new Set(old.map((m) => m.id));
        items = [...messages.filter((m) => !known.has(m.id)), ...old];
      }
      return {
        ...prev,
        [conversationId]: { items, page: pagination.page, totalPages: pagination.totalPages },
      };
    });
  }, []);

    const applyMessage = useCallback((conversationId, message, unread) => {
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: message,
                unreadCount: unread === 'add' ? c.unreadCount + 1 : c.unreadCount,
              }
            : c
        )
        .sort(latestFirst)
    );
  }, []);

    const markRead = useCallback((conversationId) => {
    socket.emit('message_read', { conversationId });
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const openConversation = useCallback(
    async (conversationId) => {
      setActiveId(conversationId);
      markRead(conversationId);
      try {
        await loadMessages(conversationId, 1);
      } catch (err) {
        console.error(err);
      }
    },
    [markRead, loadMessages]
  );

  const closeConversation = useCallback(() => setActiveId(null), []);

  const loadOlder = useCallback(
    async (conversationId) => {
      const thread = threadsRef.current[conversationId];
      if (!thread || thread.page >= thread.totalPages) return;
      try {
        await loadMessages(conversationId, thread.page + 1);
      } catch (err) {
        console.error(err);
      }
    },
    [loadMessages]
  );

  const startChatWith = useCallback(
    async (userId) => {
      const res = await chatApi.startConversation(userId);
      const conversation = res.data.data.conversation;
      seedOnline([conversation]);
      setConversations((prev) =>
        prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]
      );
      await openConversation(conversation.id);
    },
    [openConversation, seedOnline]
  );

  const sendMessage = useCallback(
    (text) =>
      new Promise((resolve, reject) => {
        const conversationId = activeIdRef.current;
        if (!conversationId) return reject(new Error('No conversation selected'));

        socket
          .timeout(8000)
          .emit('send_message', { conversationId, message: text }, (err, res) => {
            if (err) return reject(new Error('The server did not respond. Check your connection.'));
            if (!res.success) return reject(new Error(res.error));

            const { message } = res.data;
                        if (res.data.delivered) setDeliveredIds((prev) => ({ ...prev, [message.id]: true }));

            setThreads((prev) => {
              const thread = prev[conversationId];
              if (!thread) return prev;
              return { ...prev, [conversationId]: { ...thread, items: addUnique(thread.items, message) } };
            });
            applyMessage(conversationId, message, 'none');
            resolve();
          });
      }),
    [applyMessage]
  );

    const sendFile = useCallback(
    async (file) => {
      const conversationId = activeIdRef.current;
      if (!conversationId) throw new Error('No conversation selected');

      let res;
      try {
        res = await chatApi.sendMedia(conversationId, file);
      } catch (err) {
        throw new Error(err.response?.data?.error || 'Upload failed. Check your connection.');
      }

      const { message, delivered } = res.data.data;
      setThreads((prev) => {
        const thread = prev[conversationId];
        if (!thread) return prev;
        return { ...prev, [conversationId]: { ...thread, items: addUnique(thread.items, message) } };
      });
      if (delivered) setDeliveredIds((prev) => ({ ...prev, [message.id]: true }));
      applyMessage(conversationId, message, 'none');
    },
    [applyMessage]
  );


    const removeTyping = useCallback((conversationId, userId) => {
    setTypingMap((prev) => {
      const forConversation = prev[conversationId];
      if (!forConversation || !(userId in forConversation)) return prev;
      const rest = { ...forConversation };
      delete rest[userId];
      return { ...prev, [conversationId]: rest };
    });
  }, []);

  const clearTyping = useCallback(
    (conversationId, userId) => {
      clearTimeout(typingTimers.current[`${conversationId}:${userId}`]);
      removeTyping(conversationId, userId);
    },
    [removeTyping]
  );

  const sendTyping = useCallback((conversationId, isTyping) => {
    if (!socket.connected) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { conversationId });
  }, []);

  const removeFromThread = useCallback((conversationId, messageId) => {
    setThreads((prev) => {
      const thread = prev[conversationId];
      if (!thread) return prev;
      return {
        ...prev,
        [conversationId]: { ...thread, items: thread.items.filter((m) => m.id !== messageId) },
      };
    });
  }, []);

  const deleteMessage = useCallback(
    (messageId) =>
      new Promise((resolve, reject) => {
        socket.timeout(8000).emit('delete_message', { messageId }, (err, res) => {
          if (err) return reject(new Error('The server did not respond. Check your connection.'));
          if (!res.success) return reject(new Error(res.error));
          removeFromThread(res.data.conversationId, res.data.id);
          refreshConversations();
          resolve();
        });
      }),
    [removeFromThread, refreshConversations]
  );

  const typingNamesFor = (conversationId) => Object.values(typingMap[conversationId] || {});
  const getStatus = (message, conversation) => {
    if (conversation && conversation.type === 'group') {
      const others = conversation.members.filter((m) => m.id !== user.id);
      const marks = conversation.readMarks || {};
      const readBy = others.filter((m) => (marks[m.id] || 0) >= message.id).length;

      if (others.length > 0 && readBy === others.length) {
        return { key: 'read', label: '✓✓ Read by all' };
      }
      if (readBy > 0) return { key: 'partial', label: `✓✓ Read by ${readBy}` };
      if (deliveredIds[message.id]) return { key: 'delivered', label: '✓✓ Delivered' };
      return { key: 'sent', label: '✓ Sent' };
    }

    if (message.isRead) return { key: 'read', label: '✓✓ Read' };
    const other = conversation && conversation.otherUser;
    const recipientOnline = other ? onlineIds.includes(other.id) : false;
    return deliveredIds[message.id] || recipientOnline
      ? { key: 'delivered', label: '✓✓ Delivered' }
      : { key: 'sent', label: '✓ Sent' };    
  };

    const upsertConversation = useCallback(
    (conversation) => {
      seedOnline([conversation]);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversation.id);
        const next = exists
          ? prev.map((c) => (c.id === conversation.id ? conversation : c))
          : [conversation, ...prev];
        return next.sort(latestFirst);
      });
    },
    [seedOnline]
  );

  const dropConversation = useCallback((conversationId) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setThreads((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setActiveId((current) => (current === conversationId ? null : current));
  }, []);

  const createGroup = async (name, memberIds) => {
    const data = await callApi(
      () => chatApi.createGroup(name, memberIds),
      'Could not create the group'
    );

    const conversation = data.conversation;

    setThreads((prev) => ({
      ...prev,
      [conversation.id]: { items: [], page: 1, totalPages: 0 },
    }));

    upsertConversation(conversation); 
    await openConversation(conversation.id); 
    return conversation;
  };

  const renameGroup = useCallback(
    async (conversationId, name) => {
      const data = await callApi(
        () => chatApi.renameGroup(conversationId, name),
        'Could not rename the group'
      );
      upsertConversation(data.conversation);
    },
    [upsertConversation]
  );

  const changeGroupImage = useCallback(
    async (conversationId, file) => {
      const data = await callApi(
        () => chatApi.setGroupImage(conversationId, file),
        'Could not change the picture'
      );
      upsertConversation(data.conversation);
    },
    [upsertConversation]
  );

  const addMembers = useCallback(
    async (conversationId, userIds) => {
      const data = await callApi(
        () => chatApi.addGroupMembers(conversationId, userIds),
        'Could not add that person'
      );
      upsertConversation(data.conversation);
    },
    [upsertConversation]
  );

  const removeMember = useCallback(
    async (conversationId, userId) => {
      const data = await callApi(
        () => chatApi.removeGroupMember(conversationId, userId),
        'Could not remove that person'
      );
      upsertConversation(data.conversation);
    },
    [upsertConversation]
  );

  const leaveGroup = useCallback(
    async (conversationId) => {
      await callApi(() => chatApi.leaveGroup(conversationId), 'Could not leave the group');
      dropConversation(conversationId);
    },
    [dropConversation]
  );

  const deleteGroup = useCallback(
    async (conversationId) => {
      await callApi(
        () => chatApi.deleteConversation(conversationId),
        'Could not delete the group'
      );
      dropConversation(conversationId);
    },
    [dropConversation]
  );



  useEffect(() => {
    if (!activeId || threads[activeId]) return;
    loadMessages(activeId, 1).catch((err) => console.error('Could not load messages', err));
  }, [activeId, threads, loadMessages]);


  const restored = useRef(false);

  useEffect(() => {
    if (activeId) sessionStorage.setItem('activeConversation', String(activeId));
  }, [activeId]);

  useEffect(() => {
    if (restored.current || conversations.length === 0) return;
    restored.current = true;
    const saved = Number(sessionStorage.getItem('activeConversation'));
    if (saved && conversations.some((c) => c.id === saved)) openConversation(saved);
  }, [conversations, openConversation]);

   useEffect(() => {
    connectSocket();
    refreshConversations();

    const markDeliveredTo = (userId) => {
      const ids = {};
      conversationsRef.current.forEach((c) => {
        if (!c.otherUser || c.otherUser.id !== userId) return;
        const thread = threadsRef.current[c.id];
        if (!thread) return;
        thread.items.forEach((m) => {
          if (m.senderId === user.id && !m.isRead) ids[m.id] = true;
        });
      });
      if (Object.keys(ids).length) setDeliveredIds((prev) => ({ ...prev, ...ids }));
    };

    const onOnlineUsers = (ids) => {
      setOnlineIds((prev) => [...new Set([...prev, ...ids])]);
      ids.forEach((id) => markDeliveredTo(id));
    };
    const onUserOnline = ({ userId }) => {
      setOnlineIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      markDeliveredTo(userId);
    };
    const onUserOffline = ({ userId }) =>
      setOnlineIds((prev) => prev.filter((id) => id !== userId));
    const onDisconnect = () => {
      setOnlineIds([]);
      setTypingMap({});
    };
    const onReconnect = () => refreshConversations();

    const onNewMessage = (message) => {
      const conversationId = message.conversationId;
      clearTyping(conversationId, message.senderId);

      const known = conversationsRef.current.some((c) => c.id === conversationId);
      if (!known) {
        refreshConversations();
        return;
      }

      const isActive = activeIdRef.current === conversationId;
      const fromMe = message.senderId === user.id;

      setThreads((prev) => {
        const thread = prev[conversationId];
        if (!thread) return prev;
        return { ...prev, [conversationId]: { ...thread, items: addUnique(thread.items, message) } };
      });

      applyMessage(conversationId, message, isActive || fromMe ? 'none' : 'add');
      if (isActive && !fromMe) socket.emit('message_read', { conversationId });
    };

    const onTypingStart = ({ conversationId, userId, name }) => {
      setTypingMap((prev) => ({
        ...prev,
        [conversationId]: { ...(prev[conversationId] || {}), [userId]: name },
      }));
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => removeTyping(conversationId, userId), 5000);
    };
    const onTypingStop = ({ conversationId, userId }) => clearTyping(conversationId, userId);

    const onMessagesRead = ({ conversationId, readerId, lastReadMessageId }) => {
      const conversation = conversationsRef.current.find((c) => c.id === conversationId);

      if (conversation && conversation.type === 'group') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, readMarks: { ...(c.readMarks || {}), [readerId]: lastReadMessageId } }
              : c
          )
        );
        return;
      }

      setThreads((prev) => {
        const thread = prev[conversationId];
        if (!thread) return prev;
        const items = thread.items.map((m) =>
          m.senderId === user.id && !m.isRead ? { ...m, isRead: true } : m
        );
        return { ...prev, [conversationId]: { ...thread, items } };
      });
    };

    const onMessageDeleted = ({ id, conversationId }) => {
      removeFromThread(conversationId, id);
      refreshConversations();
    };

    const onConversationUpdated = () => refreshConversations();
    const onConversationRemoved = ({ conversationId }) => dropConversation(conversationId);

    socket.on('online_users', onOnlineUsers);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('new_message', onNewMessage);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);
    socket.on('messages_read', onMessagesRead);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('conversation_updated', onConversationUpdated);
    socket.on('conversation_removed', onConversationRemoved);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('online_users', onOnlineUsers);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('new_message', onNewMessage);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('messages_read', onMessagesRead);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('conversation_updated', onConversationUpdated);
      socket.off('conversation_removed', onConversationRemoved);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onReconnect);
      Object.values(typingTimers.current).forEach(clearTimeout);
      disconnectSocket();
    };
  }, [
    user.id,
    refreshConversations,
    applyMessage,
    removeTyping,
    clearTyping,
    removeFromThread,
    dropConversation,
  ]);

    const activeConversation = conversations.find((c) => c.id === activeId) || null;

    const value = {
    conversations,
    activeId,
    activeConversation,
    threads,
    onlineIds,
    loadingList,
    openConversation,
    closeConversation,
    loadOlder,
    startChatWith,
    sendMessage,
    sendFile,
    sendTyping,
    deleteMessage,
    typingNamesFor,
    getStatus,
    createGroup,
    renameGroup,
    changeGroupImage,
    addMembers,
    removeMember,
    leaveGroup,
    deleteGroup,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
