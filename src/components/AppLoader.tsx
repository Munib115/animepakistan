'use client';

import React, { useEffect, useState } from 'react';

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Check if user has already seen the launch animation in this browser session
    try {
      if (sessionStorage.getItem('ap_intro_seen')) {
        setIsDismissed(true);
        return;
      }
      sessionStorage.setItem('ap_intro_seen', '1');
    } catch (e) {}

    // Multi-stage smooth progress sequence while page loads in background
    const p1 = window.setTimeout(() => setProgress(55), 100);
    const p2 = window.setTimeout(() => setProgress(88), 350);
    const p3 = window.setTimeout(() => setProgress(100), 600);
    const p4 = window.setTimeout(() => setIsLeaving(true), 750);
    const p5 = window.setTimeout(() => setIsDismissed(true), 1200);

    return () => {
      window.clearTimeout(p1);
      window.clearTimeout(p2);
      window.clearTimeout(p3);
      window.clearTimeout(p4);
      window.clearTimeout(p5);
    };
  }, []);

  if (isDismissed) return null;

  return (
    <div 
      className={`app-loader ${isLeaving ? 'is-leaving' : ''}`} 
      id="app-initial-loader"
      role="status" 
      aria-label="Loading Anime Pakistan"
    >
      <div className="app-loader-orb orb-one" />
      <div className="app-loader-orb orb-two" />
      
      <div className="app-loader-content">
        {/* 3D Liquid Glass Badge Mark */}
        <div className="app-loader-mark" style={{ width: '94px', height: '94px', maxWidth: '94px', maxHeight: '94px', overflow: 'hidden' }}>
          <img 
            src="/logo.png?v=ap5" 
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
            transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}
