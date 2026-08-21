'use client';

import { useEffect, useState } from 'react';

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const startedAt = performance.now();
    const finish = () => {
      const elapsed = performance.now() - startedAt;
      window.setTimeout(() => {
        setIsLeaving(true);
        window.setTimeout(() => setIsVisible(false), 380);
      }, Math.max(0, 900 - elapsed));
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
    }

    const fallback = window.setTimeout(finish, 2800);
    return () => {
      window.removeEventListener('load', finish);
      window.clearTimeout(fallback);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`app-loader ${isLeaving ? 'is-leaving' : ''}`} role="status" aria-label="Loading Anime Pakistan">
      <div className="app-loader-orb orb-one" />
      <div className="app-loader-orb orb-two" />
      <div className="app-loader-content">
        <div className="app-loader-mark">
          <img src="/icon-192.png" alt="" />
          <span className="app-loader-ring" />
        </div>
        <p className="app-loader-brand"><span>ANIME</span> PAKISTAN</p>
        <p className="app-loader-caption">Urdu & Hindi Anime Streaming</p>
        <div className="app-loader-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
