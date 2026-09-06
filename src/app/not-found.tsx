import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      <div className="hero-glow" />
      <Header />
      <main
        className="container"
        style={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 16px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '48px 28px',
            textAlign: 'center',
            maxWidth: '520px',
            borderRadius: '24px',
            border: '1px solid rgba(0, 204, 102, 0.25)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(0, 102, 51, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid rgba(0, 255, 102, 0.3)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '38px', color: '#00ff66' }}>
              explore_off
            </span>
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 10px', color: '#ffffff' }}>
            404
          </h1>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 14px', color: '#e2e8f0' }}>
            صفحہ نہیں ملا (Page Not Found)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 28px' }}>
            The page you are looking for does not exist or might have been moved. You can return to the homepage or search for your favorite anime.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/"
              className="glass-btn-primary"
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                fontWeight: 800,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                home
              </span>
              <span>ہوم پیج (Home)</span>
            </Link>

            <Link
              href="/browse"
              className="glass-btn-secondary"
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                video_library
              </span>
              <span>تمام اینیمے (Browse All)</span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
