'use client';

import React, { useEffect, useState } from 'react';

// Critical Top Backdrops & Posters to preload into GPU memory during splash screen
const CRITICAL_PRELOAD_IMAGES = [
  '/logo.png?v=ap2',
  '/icon-192.png',
];

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    // Check if user has already seen the launch animation in this browser session
    try {
      if (sessionStorage.getItem('ap_intro_seen')) {
        return;
      }
      sessionStorage.setItem('ap_intro_seen', '1');
    } catch (e) {}

    // First visit: activate luxury streaming launch sequence (~0.8s)
    setIsVisible(true);

    const t1 = window.setTimeout(() => setProgress(65), 100);
    const t2 = window.setTimeout(() => setProgress(100), 380);
    const t3 = window.setTimeout(() => setIsLeaving(true), 650);
    const t4 = window.setTimeout(() => setIsVisible(false), 1080);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`app-loader ${isLeaving ? 'is-leaving' : ''}`} 
      role="status" 
      aria-label="Loading Anime Pakistan"
    >
      <div className="app-loader-orb orb-one" />
      <div className="app-loader-orb orb-two" />
      
      <div className="app-loader-content">
        {/* 3D Liquid Glass Badge Mark */}
        <div className="app-loader-mark" style={{ width: '94px', height: '94px', maxWidth: '94px', maxHeight: '94px', overflow: 'hidden' }}>
          <img 
            src="/logo.png?v=ap2" 
            alt="Anime Pakistan" 
            style={{ width: '100%', height: '100%', maxWidth: '94px', maxHeight: '94px', objectFit: 'cover', borderRadius: '24px', display: 'block' }}
          />
          <span className="app-loader-ring" />
        </div>

        {/* Brand Title */}
        <p className="app-loader-brand">
          <span>ANIME</span> PAKISTAN
        </p>
        <p className="app-loader-caption">
          Urdu & Hindi Anime Streaming
        </p>

        {/* Real-time Dynamic Smooth Progress Bar */}
        <div className="app-loader-progress" aria-hidden="true">
          <span style={{ 
            width: `${progress}%`,
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}
