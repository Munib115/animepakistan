'use client';

import React, { useEffect, useState } from 'react';

const GAME_ASSETS = [
  { url: '/offline', label: 'Game page', size: 30 },
  { url: '/emulatorjs/loader.js', label: 'Emulator loader', size: 8 },
  { url: '/emulatorjs/emulator.min.css', label: 'Emulator styles', size: 26 },
  { url: '/emulatorjs/emulator.min.js', label: 'Emulator engine', size: 427 },
  { url: '/emulatorjs/cores/reports/mgba.json', label: 'Core info', size: 1 },
  { url: '/emulatorjs/cores/mgba-wasm.data', label: 'GBA core (WASM)', size: 1056 },
  { url: '/emulatorjs/compression/extractzip.js', label: 'Decompressor', size: 196 },
  { url: '/roms/dbz-supersonic-warriors.gba', label: 'Dragon Ball Z ROM', size: 16384 },
];

const CACHE_DONE_KEY = 'ap_game_cache_v3_done';
const CACHE_NAME = 'anime-pakistan-cache-v3';

export default function GameCachePreloader() {
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [currentLabel, setCurrentLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Start 4 seconds after page load so it does NOT compete with initial render
    const startDelay = setTimeout(async () => {
      if (localStorage.getItem(CACHE_DONE_KEY) === '1') return; // already cached
      if (!('caches' in window)) return; // browser doesn't support Cache API

      setVisible(true);
      setPhase('downloading');

      const totalSize = GAME_ASSETS.reduce((s, a) => s + a.size, 0);
      let downloadedSize = 0;

      try {
        const cache = await caches.open(CACHE_NAME);

        for (const asset of GAME_ASSETS) {
          setCurrentLabel(asset.label);

          // Skip if already cached
          const existing = await cache.match(asset.url);
          if (existing) {
            downloadedSize += asset.size;
            setProgress(Math.round((downloadedSize / totalSize) * 100));
            continue;
          }

          // Fetch and store in cache
          try {
            const response = await fetch(asset.url, { cache: 'no-store' });
            if (response && response.status === 200) {
              await cache.put(asset.url, response);
            }
          } catch {
            console.warn('[GameCache] Failed to cache:', asset.url);
          }

          downloadedSize += asset.size;
          setProgress(Math.round((downloadedSize / totalSize) * 100));
        }

        localStorage.setItem(CACHE_DONE_KEY, '1');
        setPhase('done');
        setTimeout(() => setVisible(false), 4000);
      } catch (err) {
        console.warn('[GameCache] Caching error:', err);
        setPhase('error');
        setTimeout(() => setVisible(false), 3000);
      }
    }, 4000);

    return () => clearTimeout(startDelay);
  }, []);

  if (!visible || phase === 'idle') return null;

  return (
    <div className="gc-wrap" role="status" aria-live="polite">
      <div className="gc-card">

        {/* Status icon */}
        <div className="gc-icon">
          {phase === 'downloading' && (
            <span className="material-symbols-outlined gc-spin">downloading</span>
          )}
          {phase === 'done' && (
            <span className="material-symbols-outlined">check_circle</span>
          )}
          {phase === 'error' && (
            <span className="material-symbols-outlined">warning</span>
          )}
        </div>

        {/* Text content */}
        <div className="gc-text">
          {phase === 'downloading' && (
            <>
              <strong>Saving offline game...</strong>
              <span>{currentLabel}</span>
              <div className="gc-bar-track">
                <div className="gc-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="gc-pct">{progress}%</span>
            </>
          )}
          {phase === 'done' && (
            <>
              <strong>Offline game ready!</strong>
              <span>Dragon Ball Z works without internet</span>
            </>
          )}
          {phase === 'error' && (
            <>
              <strong>Cache incomplete</strong>
              <span>Will retry on next visit</span>
            </>
          )}
        </div>

        {/* Dismiss button (only after done/error) */}
        {phase !== 'downloading' && (
          <button
            type="button"
            className="gc-close"
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <style jsx>{`
        .gc-wrap {
          position: fixed;
          bottom: calc(92px + env(safe-area-inset-bottom, 0px));
          right: 16px;
          z-index: 999997;
          max-width: 300px;
          animation: gc-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (min-width: 768px) {
          .gc-wrap { bottom: 28px; right: 24px; }
        }
        @keyframes gc-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .gc-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            rgba(6, 18, 11, 0.88) 0%,
            rgba(3, 12, 7, 0.94) 100%
          );
          border: 1.2px solid rgba(0, 229, 117, 0.25);
          backdrop-filter: blur(28px) saturate(1.6);
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.55),
            0 0 24px rgba(0, 180, 90, 0.10);
          color: #f0fdf4;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .gc-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(0, 229, 117, 0.12);
          border: 1px solid rgba(0, 229, 117, 0.25);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .gc-icon .material-symbols-outlined {
          font-size: 20px;
          color: #00e575;
          font-variation-settings: 'FILL' 1, 'wght' 400;
        }
        .gc-spin {
          animation: spin 1.4s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .gc-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .gc-text strong {
          font-size: 0.82rem;
          font-weight: 700;
          color: #e2fef0;
        }
        .gc-text > span {
          font-size: 0.72rem;
          color: #6ee7b7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .gc-bar-track {
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.10);
          overflow: hidden;
          margin-top: 4px;
        }
        .gc-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #00cc6a, #00e575);
          transition: width 0.5s ease;
        }
        .gc-pct {
          font-size: 0.68rem !important;
          color: #4ade80 !important;
          font-weight: 700;
        }

        .gc-close {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          margin-top: 1px;
          transition: background 0.15s;
        }
        .gc-close:hover { background: rgba(255, 255, 255, 0.14); }
        .gc-close .material-symbols-outlined { font-size: 14px; }
      `}</style>
    </div>
  );
}
