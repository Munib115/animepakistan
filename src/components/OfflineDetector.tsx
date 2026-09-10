'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { isGameFullyCached } from '@/lib/gameCacheManager';

export default function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    // Initial connectivity check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    // Check if offline game is cached
    isGameFullyCached().then((cached) => setIsCached(cached));

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
      isGameFullyCached().then((cached) => setIsCached(cached));
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleCacheUpdated = () => {
      setIsCached(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('ap-game-cache-updated', handleCacheUpdated);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('ap-game-cache-updated', handleCacheUpdated);
    };
  }, []);

  const handlePlayOrDownload = () => {
    if (!isCached) {
      window.dispatchEvent(new CustomEvent('ap-start-manual-game-download'));
    }
  };

  if (!isOffline && !showReconnected) {
    return null;
  }

  return (
    <div className="od-wrap" role="alert">

      {/* ── OFFLINE BANNER ── */}
      {isOffline && (
        <div className="od-card od-offline">
          {/* Left: icon pill */}
          <div className="od-icon-pill od-icon-warn">
            <span className="material-symbols-outlined">
              {isCached ? 'offline_pin' : 'signal_wifi_statusbar_not_connected'}
            </span>
          </div>

          {/* Middle: text */}
          <div className="od-text">
            <strong>No Connection</strong>
            <span>{isCached ? 'Dragon Ball Z is ready offline' : 'Play Dragon Ball Z · GBA'}</span>
          </div>

          {/* Right: actions */}
          <div className="od-actions">
            <Link
              href="/offline"
              className="od-play-btn"
              onClick={handlePlayOrDownload}
            >
              <span className="material-symbols-outlined">sports_esports</span>
              <span>{isCached ? 'Play DBZ' : 'Download & Play'}</span>
            </Link>
            <button
              type="button"
              className="od-close-btn"
              onClick={() => setIsOffline(false)}
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ── RECONNECTED BANNER ── */}
      {showReconnected && (
        <div className="od-card od-online">
          <div className="od-icon-pill od-icon-ok">
            <span className="material-symbols-outlined">wifi</span>
          </div>
          <div className="od-text">
            <strong>Back Online</strong>
            <span>Streaming is ready</span>
          </div>
          <button
            type="button"
            className="od-close-btn"
            onClick={() => setShowReconnected(false)}
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      <style jsx>{`
        /* ── Wrapper ── */
        .od-wrap {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999998;
          width: calc(100% - 32px);
          max-width: 460px;
          animation: od-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes od-slide {
          from { opacity: 0; transform: translate(-50%, 22px) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, 0)   scale(1);    }
        }

        /* ── Base Card ── */
        .od-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px 10px 10px;
          border-radius: 24px;
          backdrop-filter: blur(28px) saturate(1.6);
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          color: #f0fdf4;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* ── Offline variant ── */
        .od-offline {
          background: linear-gradient(
            135deg,
            rgba(8, 22, 14, 0.82) 0%,
            rgba(4, 14, 9, 0.90) 100%
          );
          border: 1.2px solid rgba(0, 229, 117, 0.28);
          box-shadow:
            0 20px 48px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(0, 229, 117, 0.08) inset,
            0 0 28px rgba(0, 200, 100, 0.12);
        }

        /* ── Online variant ── */
        .od-online {
          background: linear-gradient(
            135deg,
            rgba(0, 40, 22, 0.84) 0%,
            rgba(0, 24, 14, 0.92) 100%
          );
          border: 1.2px solid rgba(0, 255, 136, 0.35);
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.5),
            0 0 20px rgba(0, 255, 120, 0.14);
        }

        /* ── Icon pill ── */
        .od-icon-pill {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          font-size: 20px;
        }
        .od-icon-warn {
          background: rgba(251, 191, 36, 0.14);
          border: 1px solid rgba(251, 191, 36, 0.30);
          color: #fbbf24;
          box-shadow: 0 0 16px rgba(251, 191, 36, 0.18);
        }
        .od-icon-ok {
          background: rgba(0, 229, 117, 0.14);
          border: 1px solid rgba(0, 229, 117, 0.30);
          color: #00e575;
          box-shadow: 0 0 16px rgba(0, 229, 117, 0.20);
        }
        .od-icon-pill .material-symbols-outlined {
          font-size: 22px;
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        /* ── Text block ── */
        .od-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .od-text strong {
          font-size: 0.86rem;
          font-weight: 700;
          color: #e2fef0;
          letter-spacing: 0.01em;
        }
        .od-text span {
          font-size: 0.76rem;
          color: #86efac;
          line-height: 1.3;
        }

        /* ── Actions row ── */
        .od-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        /* ── Play button ── */
        .od-play-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          border-radius: 999px;
          background: linear-gradient(135deg, #00cc6a, #00994d);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow: 0 4px 16px rgba(0, 153, 77, 0.40);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 800;
          text-decoration: none;
          letter-spacing: 0.02em;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          white-space: nowrap;
        }
        .od-play-btn:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 6px 22px rgba(0, 180, 90, 0.55);
        }
        .od-play-btn .material-symbols-outlined {
          font-size: 17px;
          font-variation-settings: 'FILL' 1, 'wght' 500;
        }

        /* ── Close button ── */
        .od-close-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #94a3b8;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: background 0.15s, color 0.15s;
        }
        .od-close-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #e2e8f0;
        }
        .od-close-btn .material-symbols-outlined {
          font-size: 16px;
        }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .od-wrap {
            /* sit above the floating tab bar (≈68px tall) + 12px gap + safe area */
            bottom: calc(92px + env(safe-area-inset-bottom, 0px));
            width: calc(100% - 20px);
          }
          .od-play-btn {
            padding: 7px 11px;
            font-size: 0.73rem;
          }
          .od-text span {
            font-size: 0.70rem;
          }
        }
      `}</style>
    </div>
  );
}
