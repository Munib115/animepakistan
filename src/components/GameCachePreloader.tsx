'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  GAME_ASSETS,
  CACHE_NAME,
  CACHE_DONE_KEY,
  isGameFullyCached,
  downloadGameAssets,
} from '@/lib/gameCacheManager';

export default function GameCachePreloader() {
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [currentLabel, setCurrentLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Silent Background Download (User requested: "without knowing the user")
  const startSilentPreload = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    const isCached = await isGameFullyCached();
    if (isCached) return;

    // Run silently in background without setting visible=true
    await downloadGameAssets();
  }, []);

  // Manual/On-demand download triggered by user click
  const startManualDownload = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    setVisible(true);
    setPhase('downloading');
    setProgress(0);

    const success = await downloadGameAssets((pct, label) => {
      setProgress(pct);
      setCurrentLabel(label);
    });

    if (success) {
      setPhase('done');
      setTimeout(() => setVisible(false), 3500);
    } else {
      setPhase('error');
      setTimeout(() => setVisible(false), 3500);
    }
  }, []);

  useEffect(() => {
    // 1. Silent background download on first website visit (starts 3.5s after load)
    const silentTimer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          startSilentPreload();
        });
      } else {
        startSilentPreload();
      }
    }, 3500);

    // 2. Listen for explicit user clicks to download
    const handleTrigger = () => {
      startManualDownload();
    };

    window.addEventListener('ap-start-manual-game-download', handleTrigger);

    return () => {
      clearTimeout(silentTimer);
      window.removeEventListener('ap-start-manual-game-download', handleTrigger);
    };
  }, [startSilentPreload, startManualDownload]);

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
              <strong>Downloading offline game...</strong>
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
              <strong>Download incomplete</strong>
              <span>Tap to retry</span>
            </>
          )}
        </div>

        {/* Dismiss button */}
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
          max-width: 320px;
          animation: gc-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (min-width: 768px) {
          .gc-wrap {
            bottom: 28px;
            right: 24px;
          }
        }
        @keyframes gc-in {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .gc-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            rgba(6, 18, 11, 0.92) 0%,
            rgba(3, 12, 7, 0.96) 100%
          );
          border: 1.2px solid rgba(0, 229, 117, 0.28);
          backdrop-filter: blur(28px) saturate(1.6);
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.55),
            0 0 24px rgba(0, 180, 90, 0.12);
          color: #f0fdf4;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .gc-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(0, 229, 117, 0.14);
          border: 1px solid rgba(0, 229, 117, 0.3);
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
          to {
            transform: rotate(360deg);
          }
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
          max-width: 200px;
        }

        .gc-bar-track {
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.12);
          overflow: hidden;
          margin-top: 4px;
        }
        .gc-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #00cc6a, #00e575);
          transition: width 0.3s ease;
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
        .gc-close:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .gc-close .material-symbols-outlined {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
