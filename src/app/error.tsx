'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side error to console for diagnosis
    console.error('AnimePakistan Navigation/Render Error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '36px 28px',
          textAlign: 'center',
          borderRadius: '28px',
          border: '1px solid rgba(0, 255, 102, 0.25)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 255, 102, 0.15)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(0, 255, 102, 0.12)',
            border: '1.5px solid rgba(0, 255, 102, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#00ff66',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
            refresh
          </span>
        </div>

        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          صفحہ لوڈ نہیں ہو سکا
        </h2>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            fontWeight: 600,
          }}
        >
          Could not load this page right now.
        </p>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            marginBottom: '28px',
            lineHeight: 1.5,
          }}
        >
          انٹرنیٹ کنکشن یا سرور پر عارضی مسئلہ ہو سکتا ہے۔ دوبارہ کوشش کریں تاکہ اینیمے فوراً لوڈ ہو سکے۔
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            className="glass-btn"
            style={{
              padding: '12px 28px',
              fontSize: '0.9rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              borderRadius: '999px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              sync
            </span>
            <span>دوبارہ کوشش کریں (Retry)</span>
          </button>

          <Link
            href="/"
            className="glass-btn-secondary"
            style={{
              padding: '12px 24px',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              borderRadius: '999px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              home
            </span>
            <span>ہوم پیج (Home)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
