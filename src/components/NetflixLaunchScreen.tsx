'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { playCinematicTudum } from '@/lib/tudumAudio';

export default function NetflixLaunchScreen() {
  const pathname = usePathname();
  const isOfflineRoute = pathname === '/offline' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/offline'));

  const [isExiting, setIsExiting] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(isOfflineRoute);
  const [hasSoundPlayed, setHasSoundPlayed] = useState(false);
  const audioTriggeredRef = useRef(false);

  const triggerSound = useCallback(() => {
    if (audioTriggeredRef.current) return;
    audioTriggeredRef.current = true;
    setHasSoundPlayed(true);
    playCinematicTudum();
  }, []);

  const dismissIntro = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsDestroyed(true);
    }, 280);
  }, []);

  useEffect(() => {
    // Immediately skip and destroy on /offline or if already played in session
    if (pathname === '/offline' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/offline'))) {
      setIsDestroyed(true);
      return;
    }

    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('ap_netflix_intro_done')) {
        setIsDestroyed(true);
        return;
      }
      sessionStorage.setItem('ap_netflix_intro_done', '1');
    }

    // 1. Play cinematic Ta-Dum
    const soundTimer = setTimeout(() => {
      triggerSound();
    }, 90);

    let animationComplete = false;
    let pageReady = false;

    const checkAndDismiss = () => {
      if (animationComplete && pageReady) {
        dismissIntro();
      }
    };

    // 2. Minimum cinematic presentation time so the user experiences the full animation
    const animTimer = setTimeout(() => {
      animationComplete = true;
      checkAndDismiss();
    }, 1800);

    // 3. Check if document and hero image are fully ready
    const evaluateReadiness = () => {
      if (typeof document === 'undefined') return;
      const isDocDone = document.readyState === 'complete';
      const heroImg = document.querySelector('.cinematic-hero-image') as HTMLImageElement | null;
      const isHeroImgDone = !heroImg || heroImg.complete;

      if (isDocDone && isHeroImgDone) {
        pageReady = true;
        checkAndDismiss();
      }
    };

    // Listen to window load event
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        evaluateReadiness();
      } else {
        window.addEventListener('load', evaluateReadiness);
      }
    }

    // Polling interval every 120ms to catch fast finishes or image completion
    const readyPoll = setInterval(() => {
      evaluateReadiness();
      if (pageReady && animationComplete) {
        clearInterval(readyPoll);
      }
    }, 120);

    // Safety fallback: maximum 3.6s so user is never trapped even on slow network
    const safetyTimer = setTimeout(() => {
      dismissIntro();
    }, 3600);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(animTimer);
      clearTimeout(safetyTimer);
      clearInterval(readyPoll);
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', evaluateReadiness);
      }
    };
  }, [dismissIntro, triggerSound, pathname, isOfflineRoute]);

  if (isOfflineRoute || isDestroyed) {
    return null;
  }

  return (
    <div
      id="ap-netflix-intro"
      className={`netflix-intro-overlay ${isExiting ? 'netflix-intro-exit' : ''}`}
      onClick={() => {
        triggerSound();
        dismissIntro();
      }}
      onTouchStart={() => {
        triggerSound();
        dismissIntro();
      }}
      aria-hidden="true"
    >
      {/* Cinematic Vignette & Deep Obsidian Canvas */}
      <div className="netflix-intro-backdrop" />

      {/* Netflix Spectrum Light Rays Eruption Container */}
      <div className="netflix-spectrum-viewport">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="netflix-spectrum-ray"
            style={
              {
                '--ray-left': `${(i / 17) * 100}%`,
                '--ray-width': `${3 + (i % 3) * 2}px`,
                '--ray-delay': `${0.58 + (i % 5) * 0.03}s`,
                '--ray-color': [
                  '#004d25',
                  '#00ff88',
                  '#00b344',
                  '#ffffff',
                  '#10b981',
                  '#34d399',
                  '#00ffaa',
                  '#f8fafc',
                  '#00e575',
                ][i % 9],
                '--ray-scale': `${1.1 + (i % 3) * 0.35}`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Central Monogram Stage */}
      <div className="netflix-intro-stage">
        {/* Anamorphic Horizontal Lens Flare Streak */}
        <div className="netflix-lens-streak" />

        {/* Radial Impact Flare Burst */}
        <div className="netflix-impact-flare" />

        {/* Netflix Monogram Vector SVG */}
        <div className="netflix-monogram-wrapper">
          <svg
            className="netflix-ap-svg"
            viewBox="0 0 512 512"
            width="170"
            height="170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Vibrant Pakistan Emerald Netflix Ribbon Gradient */}
              <linearGradient id="nfxGradA" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00381a" />
                <stop offset="35%" stopColor="#00a846" />
                <stop offset="70%" stopColor="#00ff77" />
                <stop offset="100%" stopColor="#b3ffd9" />
              </linearGradient>

              {/* Crystal Silver-White Ribbon Gradient */}
              <linearGradient id="nfxGradP" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#f1f5f9" />
                <stop offset="70%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#00dd6b" />
              </linearGradient>

              {/* Glowing Rim Filter */}
              <filter id="nfxGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Deep 3D Overlap Shadow */}
              <filter id="nfxShadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow
                  dx="-6"
                  dy="10"
                  stdDeviation="12"
                  floodColor="#000000"
                  floodOpacity="0.92"
                />
              </filter>
            </defs>

            {/* Letter 'A' Dynamic Diagonal Leg */}
            <path
              className="netflix-stroke-a-main"
              d="M 125 380 L 225 125 C 233 105, 252 92, 275 92 C 290 92, 305 100, 312 115 L 348 180 C 330 186, 316 198, 306 215 L 268 148 L 192 380 L 125 380 Z"
              fill="url(#nfxGradA)"
              filter="url(#nfxGlow)"
            />

            {/* Letter 'A' Horizontal Crossbar */}
            <path
              className="netflix-stroke-a-bar"
              d="M 160 295 L 305 295 L 290 338 L 146 338 Z"
              fill="url(#nfxGradA)"
              filter="url(#nfxGlow)"
            />

            {/* Letter 'P' Vertical Spine Ribbon */}
            <path
              className="netflix-stroke-p-stem"
              d="M 280 120 L 280 380 C 280 396, 265 408, 248 408 L 220 408 L 220 358 L 248 358 C 255 358, 262 352, 262 342 L 262 120 Z"
              fill="url(#nfxGradP)"
              filter="url(#nfxShadow)"
            />

            {/* Letter 'P' Curved Upper Loop Ribbon */}
            <path
              className="netflix-stroke-p-loop"
              d="M 262 110 L 358 110 C 408 110, 448 146, 448 196 C 448 246, 408 282, 358 282 L 262 282 Z M 282 148 L 282 244 L 354 244 C 382 244, 408 222, 408 196 C 408 170, 382 148, 354 148 Z"
              fill="url(#nfxGradP)"
              filter="url(#nfxShadow)"
            />
          </svg>
        </div>

        {/* Netflix-Style Cinematic Typography Reveal */}
        <div className="netflix-intro-brand">
          <span className="netflix-intro-title">ANIME PAKISTAN</span>
          <span className="netflix-intro-subtitle">اردو اور ہندی ڈبڈ اینیمے</span>
        </div>
      </div>
    </div>
  );
}
