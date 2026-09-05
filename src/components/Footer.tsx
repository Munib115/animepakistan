'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer" style={{
      marginTop: 'auto',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--glass-border)',
      padding: '40px 0 24px 0',
      color: 'var(--text-secondary)',
      fontSize: '0.85rem',
      position: 'relative',
      zIndex: 10,
    }}>
      <div className="container" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {/* Main Footer Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
        }}>
          {/* Brand Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* 3D Liquid Glass AP Icon */}
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 102, 51, 0.3)',
                flexShrink: 0,
                background: '#02140a',
              }}>
                <img 
                  src="/logo.png?v=ap2" 
                  alt="Anime Pakistan Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                ANIME PAKISTAN
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: '5px',
                background: '#02180d',
                border: '1px solid rgba(0, 204, 102, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                letterSpacing: '0.04em',
              }}>
                <span style={{ color: '#00ff66' }}>A</span>
                <span style={{ color: '#ffffff' }}>P</span>
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '340px' }}>
              {t('footerDesc')}
            </p>
          </div>

          {/* Quick Links */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: 'var(--text-secondary)', fontWeight: 600, transition: 'color 0.2s' }}>
              {t('home')}
            </Link>
            <Link href="/?type=series" style={{ color: 'var(--text-secondary)', fontWeight: 600, transition: 'color 0.2s' }}>
              {t('series')}
            </Link>
            <Link href="/?type=movies" style={{ color: 'var(--text-secondary)', fontWeight: 600, transition: 'color 0.2s' }}>
              {t('movies')}
            </Link>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div style={{
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}>
          <div>
            © {new Date().getFullYear()} Anime Urdu. {t('footerRights')}
          </div>
          <div>
            {t('footerPwa')}
          </div>
        </div>
      </div>
    </footer>
  );
}
