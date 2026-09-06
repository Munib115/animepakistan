import React from 'react';

export default function Loading() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          border: '3px solid rgba(0, 255, 102, 0.15)',
          borderTopColor: '#00ff66',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
        }}
      >
        لوڈ ہو رہا ہے... (Loading Anime)
      </span>
    </div>
  );
}
