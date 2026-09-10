'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Warm up service worker pre-caching for /offline and game ROM
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Ping background cache for offline page
        if (registration.active) {
          fetch('/offline', { method: 'GET', cache: 'force-cache' }).catch(() => {});
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  return (
    <div className="offline-banner-wrap" role="alert">
      {isOffline && (
        <div className="offline-notification-card">
          <div className="offline-badge-icon">
            <span className="material-symbols-outlined">wifi_off</span>
          </div>

          <div className="offline-info-col">
            <strong>Internet Disconnected</strong>
            <p>Play Dragon Ball Z (GBA) offline while you wait!</p>
          </div>

          <div className="offline-actions-col">
            <Link href="/offline" className="play-dbz-btn">
              <span className="material-symbols-outlined">sports_esports</span>
              <span>Play DBZ</span>
            </Link>
            <button
              type="button"
              className="dismiss-offline-btn"
              onClick={() => setIsOffline(false)}
              aria-label="Close Notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showReconnected && (
        <div className="online-notification-card">
          <span className="material-symbols-outlined" style={{ color: '#00ff88' }}>
            wifi
          </span>
          <span>Internet Connection Restored! Streaming ready.</span>
          <button
            type="button"
            className="dismiss-offline-btn"
            onClick={() => setShowReconnected(false)}
            aria-label="Close Notice"
          >
            ✕
          </button>
        </div>
      )}

      <style jsx>{`
        .offline-banner-wrap {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999998;
          width: calc(100% - 32px);
          max-width: 520px;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .offline-notification-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 20px;
          background: rgba(8, 24, 14, 0.94);
          border: 1.5px solid rgba(0, 229, 117, 0.4);
          backdrop-filter: blur(20px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 204, 102, 0.2);
          color: #f0fdf4;
        }

        .offline-badge-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(234, 179, 8, 0.16);
          border: 1px solid rgba(234, 179, 8, 0.35);
          color: #facc15;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .offline-info-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .offline-info-col strong {
          font-size: 0.88rem;
          color: #facc15;
        }
        .offline-info-col p {
          margin: 0;
          font-size: 0.78rem;
          color: #86efac;
          line-height: 1.3;
        }

        .offline-actions-col {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .play-dbz-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          background: #00994d;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 14px rgba(0, 153, 77, 0.45);
          color: #fff;
          font-size: 0.80rem;
          font-weight: 800;
          text-decoration: none;
          transition: transform 0.16s, background 0.16s;
        }
        .play-dbz-btn:hover {
          background: #00b359;
          transform: translateY(-2px);
        }

        .dismiss-offline-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 0;
          color: #cbd5e1;
          cursor: pointer;
          font-size: 0.75rem;
          display: grid;
          place-items: center;
        }

        .online-notification-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 18px;
          border-radius: 999px;
          background: rgba(4, 20, 10, 0.95);
          border: 1.5px solid rgba(0, 229, 117, 0.4);
          backdrop-filter: blur(20px);
          color: #00ff88;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
        }

        @media (max-width: 480px) {
          .offline-banner-wrap {
            bottom: 74px; /* avoid bottom nav bar on mobile */
            width: calc(100% - 20px);
          }
          .play-dbz-btn {
            padding: 6px 10px;
            font-size: 0.74rem;
          }
          .offline-info-col p {
            font-size: 0.72rem;
          }
        }
      `}</style>
    </div>
  );
}
