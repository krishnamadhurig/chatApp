import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import useUserSearch from '../hooks/useUserSearch';
import { formatListTime, previewText } from '../utils/format';
import Avatar from './Avatar';
import NewGroupModal from './NewGroupModal';
import { Link } from 'react-router-dom';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const {
        conversations,
        activeId,
        onlineIds,
        loadingList,
        openConversation,
        startChatWith,
        typingNamesFor,
    } = useChat();
    const [term, setTerm] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false);
    const results = useUserSearch(term);

    const handleStart = async (userId) => {
        try {
            await startChatWith(userId);
            setTerm('');
        } catch (err) {
            console.error(err);
        }
    };

    const previewFor = (c) => {
        const typingNames = typingNamesFor(c.id);
        if (typingNames.length) {
            return c.type === 'group' ? `${typingNames.join(', ')} typing...` : 'typing...';
        }

        const m = c.lastMessage;
        if (!m) return 'No messages yet';

        const text = previewText(m);
        if (c.type !== 'group') return text;

        const sender =
            m.senderId === user.id
                ? 'You'
                : (c.members.find((x) => x.id === m.senderId) || {}).name || 'Someone';
        return `${sender.split(' ')[0]}: ${text}`;
    };

    return (
        <aside className="sidebar">
            <div className="me-bar">
                <Avatar name={user.name} online={true} />
                <div className="grow">
                    <strong>{user.name}</strong>
                    <span className="muted">{user.email}</span>
                </div>
                <button className="link-btn" onClick={logout}>Log out</button>
                <Link to="/profile" className="profile-link">
                    <Avatar name={user.name} size={32} image={user.profileImage} />
                </Link>
            </div>

            <div className="search">
                <input
                    type="search"
                    placeholder="Search people by name or email"
                    aria-label="Search people"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                />
                <button type="button" className="new-group-btn" onClick={() => setShowGroupModal(true)}>
                    New group
                </button>
            </div>

            <ul className="list">
                {term.trim() ? (
                    results.length === 0 ? (
                        <li className="empty">No users found</li>
                    ) : (
                        results.map((u) => (
                            <li key={u.id}>
                                <button className="person" onClick={() => handleStart(u.id)}>
                                    <Avatar name={u.name} online={onlineIds.includes(u.id)} />
                                    <div className="conv-body">
                                        <strong>{u.name}</strong>
                                        <span className="preview">{u.email}</span>
                                    </div>
                                    <span className="start">Chat</span>
                                </button>
                            </li>
                        ))
                    )
                ) : loadingList ? (
                    <li className="empty">Loading...</li>
                ) : conversations.length === 0 ? (
                    <li className="empty">No conversations yet. Search for someone above to start one.</li>
                ) : (
                    conversations.map((c) => (
                        <li key={c.id}>
                            <button
                                className={`conv ${c.id === activeId ? 'active' : ''}`}
                                onClick={() => openConversation(c.id)}
                            >
                                <Avatar
                                    name={c.name}
                                    image={c.image}
                                    online={c.otherUser ? onlineIds.includes(c.otherUser.id) : undefined}
                                />
                                <div className="conv-body">
                                    <div className="conv-top">
                                        <strong>{c.name}</strong>
                                        {c.lastMessage && (
                                            <span className="muted small">{formatListTime(c.lastMessage.createdAt)}</span>
                                        )}
                                    </div>
                                    <div className="conv-bottom">
                                        <span className={`preview ${typingNamesFor(c.id).length ? 'typing' : ''}`}>
                                            {previewFor(c)}
                                        </span>
                                        {c.unreadCount > 0 && <span className="badge">{c.unreadCount}</span>}
                                    </div>
                                </div>
                            </button>
                        </li>
                    ))
                )}
            </ul>

            {showGroupModal && <NewGroupModal onClose={() => setShowGroupModal(false)} />}
        </aside>
    );
}