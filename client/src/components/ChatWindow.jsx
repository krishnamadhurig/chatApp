import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import GroupInfo from './GroupInfo';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeConversation, onlineIds, closeConversation, typingNamesFor } = useChat();
  const [showInfo, setShowInfo] = useState(false);
  const activeConvId = activeConversation ? activeConversation.id : null;

  useEffect(() => {
    setShowInfo(false);
  }, [activeConvId]);

  if (!activeConversation) {
    return (
      <section className="window window-empty">
        <p>Select a conversation, or search for someone to start chatting.</p>
      </section>
    );
  }

  const c = activeConversation;
  const isGroup = c.type === 'group';
  const online = c.otherUser ? onlineIds.includes(c.otherUser.id) : undefined;
  const typingNames = typingNamesFor(c.id);
  const isTyping = typingNames.length > 0;
  const onlineCount = isGroup
    ? c.members.filter((m) => m.id === user.id || onlineIds.includes(m.id)).length
    : 0;

  let status;
  if (isTyping) status = isGroup ? `${typingNames.join(', ')} typing...` : 'typing...';
  else if (isGroup) status = `${c.members.length} members · ${onlineCount} online`;
  else status = online ? 'Online' : 'Offline';

  const statusClass = isTyping ? 'typing' : !isGroup && online ? 'on' : '';

  return (
    <section className="window">
      <header className="window-head">
        <button className="back-btn" onClick={closeConversation} aria-label="Back to conversations">
          ‹
        </button>
        <Avatar name={c.name} image={c.image} online={online} />

        {isGroup ? (
          <button
            className="info info-btn"
            onClick={() => setShowInfo(true)}
            aria-label="Open group info"
          >
            <strong>{c.name}</strong>
            <span className={`status ${statusClass}`}>{status}</span>
          </button>
        ) : (
          <div className="info">
            <strong>{c.name}</strong>
            <span className={`status ${statusClass}`}>{status}</span>
          </div>
        )}
      </header>

      <MessageList key={c.id} conversationId={c.id} />
      <MessageInput key={`input-${c.id}`} conversationId={c.id} />

      {showInfo && isGroup && <GroupInfo conversation={c} onClose={() => setShowInfo(false)} />}
    </section>
  );
}