import React from 'react';

export default function Loading() {
  return (
    <div className="apple-loader-viewport">
      {/* Subtle ambient backdrop glow */}
      <div
        style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(0, 255, 102, 0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Apple-style Frosted Glass Capsule */}
      <div className="apple-loader-capsule">
        {/* Apple 3D Continuous Squircle App Emblem */}
        <div className="apple-loader-icon-container">
          <div className="apple-loader-icon-aura" />
          <img
            src="/logo.png?v=ap2"
            alt="Anime Pakistan Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'relative',
              zIndex: 2,
            }}
          />
        </div>

        {/* Authentic Apple 12-Blade Radial Spinner */}
        <svg
          className="apple-ios-spinner"
          viewBox="0 0 36 36"
          aria-label="Loading indicator"
        >
          {[...Array(12)].map((_, i) => (
            <rect
              key={i}
              x="16.5"
              y="2"
              width="3"
              height="8"
              rx="1.5"
              transform={`rotate(${i * 30} 18 18)`}
              className={`apple-ios-blade blade-${i}`}
            />
          ))}
        </svg>

        {/* Professional Typography */}
        <h2
          style={{
            fontSize: '1.15rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.25,
            marginBottom: '4px',
            letterSpacing: '-0.01em',
          }}
        >
          لوڈ ہو رہا ہے...
        </h2>
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '16px',
            letterSpacing: '0.01em',
          }}
        >
          Loading Anime Experience
        </span>

        {/* Apple Live Status Pill */}
        <div className="apple-loader-status-pill">
          <span className="apple-loader-beacon" />
          <span>فاسٹ اسٹریمنگ کنیکٹ ہو رہی ہے</span>
        </div>

        {/* Apple Shimmer Progress Track */}
        <div className="apple-loader-track">
          <div className="apple-loader-bar" />
        </div>
      </div>
    </div>
  );
}
