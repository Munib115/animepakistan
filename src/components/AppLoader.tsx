'use client';

import React, { useEffect, useState } from 'react';

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [progress, setProgress] = useState(30);

  useEffect(() => {
    // Check if user has already seen the launch animation or is reloading
    try {
      let isReload = false;
      if (typeof window !== 'undefined' && window.performance) {
        if (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) {
          isReload = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type === 'reload';
        } else if (performance.navigation) {
          isReload = performance.navigation.type === 1;
        }
      }

      if (isReload || localStorage.getItem('ap_intro_seen') || sessionStorage.getItem('ap_intro_seen')) {
        setIsDismissed(true);
        return;
      }
      
      localStorage.setItem('ap_intro_seen', '1');
      sessionStorage.setItem('ap_intro_seen', '1');
    } catch (e) {}

    // First visit only: brief 450ms luxury intro
    setIsDismissed(false);

    const p1 = window.setTimeout(() => setProgress(80), 80);
    const p2 = window.setTimeout(() => setProgress(100), 220);
    const p3 = window.setTimeout(() => setIsLeaving(true), 380);
    const p4 = window.setTimeout(() => setIsDismissed(true), 680);

    return () => {
      window.clearTimeout(p1);
      window.clearTimeout(p2);
      window.clearTimeout(p3);
      window.clearTimeout(p4);
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
            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}
