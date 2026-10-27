import { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import useUserSearch from '../hooks/useUserSearch';
import Avatar from './Avatar';

export default function NewGroupModal({ onClose }) {
  const { createGroup, onlineIds } = useChat();
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const results = useUserSearch(term);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isSelected = (id) => selected.some((u) => u.id === id);
  const toggle = (u) =>
    setSelected((prev) => (isSelected(u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give the group a name');
    if (selected.length === 0) return setError('Choose at least one person');

    setBusy(true);
    setError('');
    try {
      await createGroup(name.trim(), selected.map((u) => u.id));
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
      >
        <h2 id="new-group-title">New group</h2>
        {error && <div className="error">{error}</div>}

        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />

        <label htmlFor="group-search">Add people</label>
        <input
          id="group-search"
          type="search"
          placeholder="Search by name or email"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />

        {selected.length > 0 && (
          <div className="chips">
            {selected.map((u) => (
              <button type="button" className="chip" key={u.id} onClick={() => toggle(u)}>
                {u.name} ✕
              </button>
            ))}
          </div>
        )}

        <ul className="pick-list">
          {results.map((u) => (
            <li key={u.id}>
              <button type="button" className="person" onClick={() => toggle(u)}>
                <Avatar name={u.name} size={36} online={onlineIds.includes(u.id)} />
                <div className="conv-body">
                  <strong>{u.name}</strong>
                  <span className="preview">{u.email}</span>
                </div>
                <span className="start">{isSelected(u.id) ? 'Added' : 'Add'}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Creating...' : 'Create group'}
          </button>
        </div>
      </form>
    </div>
  );
}