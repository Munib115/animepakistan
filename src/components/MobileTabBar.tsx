'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';

function TabBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get('type');
  const { language, setLanguage, t } = useLanguage();

  const isHome = pathname === '/' && !currentType;
  const isBrowse = pathname === '/browse' && !currentType;
  const isSeries = (pathname === '/browse' && currentType === 'series') || (pathname === '/' && currentType === 'series');
  const isMovies = (pathname === '/browse' && currentType === 'movies') || (pathname === '/' && currentType === 'movies');

  const tabs = [
    {
      id: 'home',
      label: t('home'),
      icon: 'home',
      href: '/',
      active: isHome,
    },
    {
      id: 'browse',
      label: t('browse'),
      icon: 'apps',
      href: '/browse',
      active: isBrowse,
    },
    {
      id: 'series',
      label: t('series'),
      icon: 'live_tv',
      href: '/browse?type=series',
      active: isSeries,
    },
    {
      id: 'movies',
      label: t('movies'),
      icon: 'movie',
      href: '/browse?type=movies',
      active: isMovies,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom App Navigation"
      className="apple-liquid-glass-dock"
      style={{
        position: 'fixed',
        bottom: 'calc(12px + var(--sab, 0px))',
        left: '16px',
        right: '16px',
        maxWidth: '440px',
        margin: '0 auto',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '6px 8px',
        background: 'rgba(8, 22, 14, 0.88)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderRadius: '24px',
        border: '1px solid rgba(0, 230, 118, 0.25)',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 230, 118, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {tabs.map((tab) => (
        <Link 
          key={tab.id}
          href={tab.href}
          onClick={() => sound.playTabSwitch()}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            flex: 1,
            padding: '6px 4px',
            borderRadius: '16px',
            textDecoration: 'none',
            color: tab.active ? '#00ff88' : 'rgba(255, 255, 255, 0.6)',
            transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: tab.active ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
            boxShadow: tab.active ? '0 0 12px rgba(0, 230, 118, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)' : 'none',
          }}
          className={`dock-tab-item ${tab.active ? 'active-tab' : ''}`}
        >
          <span 
            className="material-symbols-outlined dock-icon" 
            style={{ 
              fontSize: '21px',
              transform: tab.active ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
              filter: tab.active ? 'drop-shadow(0 0 6px rgba(0, 255, 136, 0.6))' : 'none',
            }}
          >
            {tab.icon}
          </span>
          <span style={{
            fontSize: '0.64rem',
            fontWeight: tab.active ? 800 : 500,
            letterSpacing: '0.02em',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </span>
        </Link>
      ))}

      {/* Language Quick Switcher Tab */}
      <button 
        onClick={() => setLanguage(language === 'ur' ? 'en' : 'ur')}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          flex: 1,
          padding: '6px 4px',
          borderRadius: '16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'inherit',
          transition: 'all 0.25s ease',
        }}
        className="dock-tab-item"
        aria-label="Switch Language"
      >
        <span className="material-symbols-outlined dock-icon" style={{ fontSize: '21px' }}>
          translate
        </span>
        <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {language === 'ur' ? 'EN' : 'اردو'}
        </span>
      </button>

      <style jsx>{`
        .dock-tab-item:active {
          transform: scale(0.92);
        }
        @media (min-width: 768px) {
          .apple-liquid-glass-dock {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}

export default function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <TabBarContent />
    </Suspense>
  );
}
