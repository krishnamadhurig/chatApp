import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';

const REPEAT_MS = 2000;
const IDLE_MS = 2500;
const MAX_FILE_MB = 10;
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

export default function MessageInput({ conversationId }) {
  const { sendMessage, sendFile, sendTyping } = useChat();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef(null);
  const lastSent = useRef(0);
  const idleTimer = useRef(null);
  const isTyping = useRef(false);

  const stopTyping = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (isTyping.current) {
      isTyping.current = false;
      lastSent.current = 0;
      sendTyping(conversationId, false);
    }
  }, [conversationId, sendTyping]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    const now = Date.now();
    if (now - lastSent.current > REPEAT_MS) {
      sendTyping(conversationId, true);
      lastSent.current = now;
      isTyping.current = true;
    }

    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, IDLE_MS);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    stopTyping();
    setSending(true);
    setError('');
    try {
      await sendMessage(value);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_FILE_MB} MB)`);
      return;
    }

    stopTyping();
    setError('');
    setUploading(true);
    try {
      await sendFile(file);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {error && <div className="composer-error">{error}</div>}
      <form className="composer" onSubmit={handleSubmit}>
        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          aria-label="Attach a file"
        >
          📎
        </button>
        <input
          type="text"
          placeholder={uploading ? 'Uploading...' : 'Type a message'}
          value={text}
          onChange={handleChange}
          maxLength={5000}
          disabled={uploading}
        />
        <button className="send-btn" type="submit" disabled={sending || uploading || !text.trim()}>
          Send
        </button>
      </form>
    </>
  );
}