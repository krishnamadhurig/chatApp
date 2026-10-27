import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import MessageBubble from './MessageBubble';

export default function MessageList({ conversationId }) {
  const { user } = useAuth();
  const { threads, loadOlder, activeConversation, getStatus, deleteMessage } = useChat();
  const thread = threads[conversationId];
  const items = thread ? thread.items : [];
  const lastId = items.length ? items[items.length - 1].id : null;
  const isGroup = activeConversation && activeConversation.type === 'group';
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    if (bottomRef.current) bottomRef.current.scrollIntoView();
  };

  useEffect(scrollToBottom, [conversationId, lastId]);

  return (
    <div className="messages">
      {thread && thread.page < thread.totalPages && (
        <button className="load-older" onClick={() => loadOlder(conversationId)}>
          Load older messages
        </button>
      )}
      {!thread && <p className="muted center-text">Loading...</p>}
      {thread && items.length === 0 && (
        <p className="muted center-text">No messages yet. Say hello!</p>
      )}
      {items.map((m, i) => {
        const mine = m.senderId === user.id;
        const startsRun = i === 0 || items[i - 1].senderId !== m.senderId;
        return (
          <MessageBubble
            key={m.id}
            message={m}
            mine={mine}
            status={mine ? getStatus(m, activeConversation) : undefined}
            senderName={isGroup && !mine && startsRun && m.sender ? m.sender.name : undefined}
            onDelete={deleteMessage}
            onMediaLoad={m.id === lastId ? scrollToBottom : undefined}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}