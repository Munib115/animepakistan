'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface HeroSectionProps {
  moviesCount: number;
  seriesCount: number;
}

export default function HeroSection({ moviesCount, seriesCount }: HeroSectionProps) {
  const { t } = useLanguage();

  return (
    <section style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '24px 12px 32px 12px',
      gap: '12px',
    }}>
      {/* Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0, 102, 51, 0.08)',
        border: '1px solid rgba(0, 102, 51, 0.25)',
        borderRadius: '9999px',
        padding: '6px 14px',
        color: 'var(--color-primary)',
        fontSize: '0.8rem',
        fontWeight: 700,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
          live_tv
        </span>
        <span>{t('heroBadge')}</span>
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
        fontWeight: 900,
        lineHeight: 1.15,
        color: 'var(--text-primary)',
        maxWidth: '750px',
        letterSpacing: '-0.02em',
      }}>
        {t('heroTitle1')} <span style={{ color: 'var(--color-primary)' }}>{t('heroTitle2')}</span>
      </h1>

      <p style={{
        fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
        color: 'var(--text-secondary)',
        maxWidth: '580px',
        lineHeight: 1.5,
      }}>
        {t('heroSubtitle')}
      </p>

      {/* Quick Metrics */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginTop: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          fontWeight: 600,
          background: 'var(--bg-secondary)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>movie</span>
          <span>{moviesCount} {t('moviesCountBadge')}</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          fontWeight: 600,
          background: 'var(--bg-secondary)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>live_tv</span>
          <span>{seriesCount} {t('seriesCountBadge')}</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          fontWeight: 600,
          background: 'var(--bg-secondary)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>devices</span>
          <span>{t('pwaReadyBadge')}</span>
        </div>
      </div>
    </section>
  );
}
