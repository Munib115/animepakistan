'use client';

import React, { useEffect, useState, useRef } from 'react';
import { sound } from '@/lib/soundEngine';

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [progress, setProgress] = useState(25);
  const anthemPlayedRef = useRef(false);

  useEffect(() => {
    // 1. Play Pakistan National Anthem beat / motif during loading animation
    const tryPlayAnthem = () => {
      if (!anthemPlayedRef.current) {
        anthemPlayedRef.current = true;
        sound.playAnthemBeat();
      }
    };

    // Attempt immediately on mount
    tryPlayAnthem();

    // Fallback: If browser audio policy suspended AudioContext, trigger on first user interaction
    const unlockAndPlay = () => {
      tryPlayAnthem();
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      window.removeEventListener('touchstart', unlockAndPlay);
    };
    window.addEventListener('pointerdown', unlockAndPlay, { passive: true, once: true });
    window.addEventListener('keydown', unlockAndPlay, { passive: true, once: true });
    window.addEventListener('touchstart', unlockAndPlay, { passive: true, once: true });

    // Ensure initial page launch always starts cleanly at the top of the viewport
    try {
      if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
    } catch (e) {}

    // 2. Smooth, luxury progress bar sequence (~1.1s total)
    const t1 = window.setTimeout(() => setProgress(55), 120);
    const t2 = window.setTimeout(() => setProgress(88), 380);
    const t3 = window.setTimeout(() => setProgress(100), 700);
    const t4 = window.setTimeout(() => {
      setIsLeaving(true);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }, 920);
    const t5 = window.setTimeout(() => setIsDismissed(true), 1350);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      window.removeEventListener('touchstart', unlockAndPlay);
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
        <div 
          className="app-loader-mark" 
          style={{ width: '96px', height: '96px', maxWidth: '96px', maxHeight: '96px', overflow: 'hidden', cursor: 'pointer' }}
          onClick={() => sound.playAnthemBeat()}
          title="Anime Pakistan - Click to play Anthem Beat"
        >
          <img 
            src="/logo.png?v=ap5" 
            alt="Anime Pakistan" 
            style={{ width: '100%', height: '100%', maxWidth: '96px', maxHeight: '96px', objectFit: 'cover', borderRadius: '24px', display: 'block' }}
          />
          <span className="app-loader-ring" />
        </div>

        {/* Brand Title */}
        <p className="app-loader-brand">
          <span>ANIME</span> PAKISTAN
        </p>
        <p className="app-loader-caption">
          Urdu &amp; Hindi Anime Streaming
        </p>

        {/* Real-time Dynamic Smooth Progress Bar */}
        <div className="app-loader-progress" aria-hidden="true">
          <span style={{ 
            width: `${progress}%`,
            transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}
