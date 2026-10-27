import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/chatService';
import Avatar from '../components/Avatar';

const MAX_SIZE = 10 * 1024 * 1024;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
const fileRef = useRef(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url); 
  }, [file]);

  const choose = (e) => {
    const picked = e.target.files[0];
    e.target.value = ''; 
    if (!picked) return;
    if (!picked.type.startsWith('image/')) return setError('Please choose an image file');
    if (picked.size > MAX_SIZE) return setError('The image must be 10 MB or smaller');
    setError('');
    setMessage('');
    setFile(picked);
  };

  const unchanged = name.trim() === user.name && !file;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const res = await updateProfile({
        name: name.trim() !== user.name ? name.trim() : undefined,
        file,
      });
      updateUser(res.data.data.user);
      setFile(null);
      setMessage('Profile updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <form className="profile-card" onSubmit={submit}>
        <Link to="/" className="profile-back">← Back to chats</Link>
        <h1>Your profile</h1>

        <div className="profile-photo">
  <Avatar name={name || user.name} size={96} image={preview || user.profileImage} />
  <input
    ref={fileRef}
    type="file"
    accept=".jpg,.jpeg,.png,.gif,.webp"
    hidden
    onChange={choose}
  />
  <button type="button" className="link-btn" onClick={() => fileRef.current.click()}>
    Change photo
  </button>
</div>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>

        <label>
          Email
          <input value={user.email} disabled />
        </label>

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-ok">{message}</p>}

        <button type="submit" disabled={saving || unchanged}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}