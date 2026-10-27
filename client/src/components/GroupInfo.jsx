import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import useUserSearch from '../hooks/useUserSearch';
import Avatar from './Avatar';

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp';

export default function GroupInfo({ conversation, onClose }) {
  const { user } = useAuth();
  const { onlineIds, renameGroup, changeGroupImage, addMembers, removeMember, leaveGroup, deleteGroup } =
    useChat();

  const isCreator = conversation.createdBy === user.id;
  const [name, setName] = useState(conversation.name);
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef(null);

  const results = useUserSearch(isCreator ? term : '');
  const memberIds = conversation.members.map((m) => m.id);
  const candidates = results.filter((u) => !memberIds.includes(u.id));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (task) => {
    setError('');
    setBusy(true);
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value || value === conversation.name) return;
    run(() => renameGroup(conversation.id, value));
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    run(() => changeGroupImage(conversation.id, file));
  };

  const handleAdd = (u) =>
    run(async () => {
      await addMembers(conversation.id, [u.id]);
      setTerm('');
    });

  const handleRemove = (u) => run(() => removeMember(conversation.id, u.id));

  const handleLeave = () =>
    run(async () => {
      await leaveGroup(conversation.id);
      onClose();
    });

  const handleDelete = () =>
    run(async () => {
      await deleteGroup(conversation.id);
      onClose();
    });

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="group-info-title">
        <h2 id="group-info-title" className="sr-only">Group info</h2>

        <div className="group-head">
          <Avatar name={conversation.name} size={72} image={conversation.image} />
          <div className="group-head-text">
            {isCreator ? (
              <form className="rename-form" onSubmit={handleRename}>
                <label htmlFor="rename-group" className="sr-only">Group name</label>
                <input
                  id="rename-group"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
                <button
                  type="submit"
                  className="primary-btn small-btn"
                  disabled={busy || !name.trim() || name.trim() === conversation.name}
                >
                  Save
                </button>
              </form>
            ) : (
              <strong className="group-name">{conversation.name}</strong>
            )}
            <span className="muted">{conversation.members.length} members</span>
            {isCreator && (
              <>
                <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={handleImage} />
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => fileRef.current.click()}
                  disabled={busy}
                >
                  Change picture
                </button>
              </>
            )}
          </div>
        </div>

        <h3 className="section-title">Members</h3>
        <ul className="member-list">
          {conversation.members.map((m) => {
            const isMe = m.id === user.id;
            return (
              <li key={m.id} className="member-row">
                <Avatar name={m.name} size={36} online={isMe || onlineIds.includes(m.id)} />
                <div className="member-text">
                  <strong>{isMe ? `${m.name} (you)` : m.name}</strong>
                  <span className="muted small">{m.email}</span>
                </div>
                {m.id === conversation.createdBy && <span className="role-tag">Creator</span>}
                {isCreator && !isMe && (
                  <button
                    type="button"
                    className="danger-link"
                    onClick={() => handleRemove(m)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {isCreator && (
          <>
            <h3 className="section-title">Add people</h3>
            <input
              type="search"
              placeholder="Search by name or email"
              aria-label="Search people to add"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <ul className="pick-list">
              {term.trim() && candidates.length === 0 && <li className="empty">No one to add</li>}
              {candidates.map((u) => (
                <li key={u.id}>
                  <button type="button" className="person" onClick={() => handleAdd(u)} disabled={busy}>
                    <Avatar name={u.name} size={36} online={onlineIds.includes(u.id)} />
                    <div className="conv-body">
                      <strong>{u.name}</strong>
                      <span className="preview">{u.email}</span>
                    </div>
                    <span className="start">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <div className="modal-actions spread">
          {confirm === 'leave' && (
            <>
              <span>
                {isCreator
                  ? 'Leave? Ownership passes to the member who joined first.'
                  : 'Leave this group?'}
              </span>
              <button type="button" className="danger-btn" onClick={handleLeave} disabled={busy}>
                Yes, leave
              </button>
              <button type="button" className="ghost-btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </>
          )}
          {confirm === 'delete' && (
            <>
              <span>Delete for everyone? This cannot be undone.</span>
              <button type="button" className="danger-btn" onClick={handleDelete} disabled={busy}>
                Yes, delete
              </button>
              <button type="button" className="ghost-btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </>
          )}
          {confirm === null && (
            <>
              <button type="button" className="danger-btn" onClick={() => setConfirm('leave')}>
                Leave group
              </button>
              {isCreator && (
                <button type="button" className="danger-btn" onClick={() => setConfirm('delete')}>
                  Delete group
                </button>
              )}
              <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}