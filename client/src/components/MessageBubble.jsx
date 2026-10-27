import { useState } from 'react';
import { formatTime } from '../utils/format';

const hue = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

export default function MessageBubble({ message, mine, status, senderName, onDelete, onMediaLoad }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    try {
      await onDelete(message.id);
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    }
  };

  return (
    <div className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
      <div className="bubble">
        {senderName && (
          <span className="sender-name" style={{ color: `hsl(${hue(senderName)} 55% 38%)` }}>
            {senderName}
          </span>
        )}

        {message.messageType === 'text' && <p>{message.message}</p>}

        {message.messageType === 'image' &&
          (message.mediaUrl ? (
            <a href={message.mediaUrl} target="_blank" rel="noreferrer">
              <img
                className="chat-img"
                src={message.mediaUrl}
                alt={message.fileName || 'Image'}
                loading="lazy"
                onLoad={onMediaLoad}
              />
            </a>
          ) : (
            <p>Image unavailable</p>
          ))}

        {message.messageType === 'file' && (
          <div className="file-card">
            <span className="file-icon">📄</span>
            <div className="file-info">
              <span className="file-name">{message.fileName}</span>
              {message.mediaUrl ? (
                <a className="file-dl" href={message.mediaUrl}>Download</a>
              ) : (
                <span>File unavailable</span>
              )}
            </div>
          </div>
        )}

        <div className="bubble-meta">
          <span className="time">{formatTime(message.createdAt)}</span>
          {mine && status && <span className={`ticks ${status.key}`}>{status.label}</span>}
          {mine &&
            (confirming ? (
              <>
                <span>Delete?</span>
                <button className="confirm-btn" onClick={handleDelete}>Yes</button>
                <button className="confirm-btn" onClick={() => setConfirming(false)}>No</button>
              </>
            ) : (
              <button className="del-btn" onClick={() => setConfirming(true)}>Delete</button>
            ))}
        </div>

        {error && <div className="bubble-error">{error}</div>}
      </div>
    </div>
  );
}