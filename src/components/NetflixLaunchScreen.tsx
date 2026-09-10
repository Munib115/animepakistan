'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { playCinematicTudum } from '@/lib/tudumAudio';

export default function NetflixLaunchScreen() {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);
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
    try {
      sessionStorage.setItem('ap_netflix_intro_seen', '1');
    } catch {
      // safe fallback
    }
    setTimeout(() => {
      setIsDestroyed(true);
    }, 400);
  }, []);

  useEffect(() => {
    // Only display on initial website open in the browser session
    try {
      const alreadySeen = sessionStorage.getItem('ap_netflix_intro_seen');
      if (alreadySeen) {
        setIsDestroyed(true);
        return;
      }
    } catch {
      // safe fallback
    }

    setMounted(true);

    // Attempt automatic playback of cinematic Ta-Dum
    const soundTimer = setTimeout(() => {
      triggerSound();
    }, 80);

    // Netflix intro presentation: 1.65s (synchronized with A & P ribbon strikes and full sound decay)
    const exitTimer = setTimeout(() => {
      dismissIntro();
    }, 1650);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(exitTimer);
    };
  }, [dismissIntro, triggerSound]);

  if (!mounted || isDestroyed) {
    return null;
  }

  return (
    <div
      id="ap-netflix-intro"
      className={`netflix-intro-overlay ${isExiting ? 'netflix-intro-exit' : ''}`}
      onClick={() => {
        // If sound was blocked by browser autoplay, first tap enables sound
        if (!hasSoundPlayed) {
          triggerSound();
        }
      }}
      aria-hidden="true"
    >
      {/* Cinematic Vignette & Deep Obsidian Canvas */}
      <div className="netflix-intro-backdrop" />

      {/* Top Header Bar: Sound Indicator & Skip Button */}
      <div className="netflix-intro-topbar">
        <button
          type="button"
          className="netflix-sound-badge"
          onClick={(e) => {
            e.stopPropagation();
            triggerSound();
          }}
          aria-label="Play Sound"
        >
          <span className="netflix-sound-icon">
            {hasSoundPlayed ? '🔊' : '🔈'}
          </span>
          <span>{hasSoundPlayed ? 'CINEMA AUDIO' : 'TAP FOR SOUND'}</span>
        </button>

        <button
          type="button"
          className="netflix-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            dismissIntro();
          }}
          aria-label="Skip Intro"
        >
          <span>Skip ›</span>
        </button>
      </div>

      {/* Netflix Spectrum Light Rays Eruption Container */}
      <div className="netflix-spectrum-viewport">
        {Array.from({ length: 26 }).map((_, i) => (
          <div
            key={i}
            className="netflix-spectrum-ray"
            style={
              {
                '--ray-left': `${(i / 25) * 100}%`,
                '--ray-width': `${2 + (i % 4) * 2}px`,
                '--ray-delay': `${0.62 + (i % 7) * 0.025}s`,
                '--ray-color': [
                  '#004d25',
                  '#00ff88',
                  '#00b344',
                  '#ffffff',
                  '#10b981',
                  '#34d399',
                  '#00ffaa',
                  '#e2e8f0',
                  '#00e575',
                  '#ffffff',
                  '#008040',
                  '#80ffbf',
                ][i % 12],
                '--ray-scale': `${1 + (i % 3) * 0.4}`,
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
