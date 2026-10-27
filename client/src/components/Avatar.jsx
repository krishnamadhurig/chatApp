import { useEffect, useState } from 'react';

const hue = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

export default function Avatar({ name = '?', size = 42, online, image }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  const showImage = image && !failed;

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: showImage ? 'var(--line)' : `hsl(${hue(name)} 42% 38%)`,
      }}
    >
      {showImage ? (
        <img className="avatar-img" src={image} alt="" onError={() => setFailed(true)} />
      ) : (
        name[0].toUpperCase()
      )}
      {online !== undefined && <span className={`presence ${online ? 'on' : ''}`} />}
    </div>
  );
}