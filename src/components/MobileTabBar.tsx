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
        bottom: 'calc(10px + var(--sab, 0px))',
        left: '14px',
        right: '14px',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(30px) saturate(210%)',
        WebkitBackdropFilter: 'blur(30px) saturate(210%)',
        borderRadius: '9999px',
        border: '1.5px solid rgba(255, 255, 255, 0.9)',
        boxShadow: '0 16px 36px -4px rgba(0, 70, 35, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 2px rgba(255, 255, 255, 1)',
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
            gap: '2px',
            flex: 1,
            padding: '7px 4px',
            borderRadius: '9999px',
            textDecoration: 'none',
            color: tab.active ? 'var(--color-primary)' : 'var(--text-muted)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: tab.active ? 'rgba(0, 102, 51, 0.12)' : 'transparent',
            boxShadow: tab.active ? '0 2px 8px rgba(0, 102, 51, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.8)' : 'none',
          }}
          className={`dock-tab-item ${tab.active ? 'active-tab' : ''}`}
        >
          <span 
            className="material-symbols-outlined dock-icon" 
            style={{ 
              fontSize: '22px',
              transform: tab.active ? 'scale(1.18)' : 'scale(1)',
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
              filter: tab.active ? 'drop-shadow(0 2px 4px rgba(0, 102, 51, 0.25))' : 'none',
            }}
          >
            {tab.icon}
          </span>
          <span style={{
            fontSize: '0.66rem',
            fontWeight: tab.active ? 900 : 600,
            letterSpacing: '0.01em',
            transition: 'all 0.2s ease',
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
          gap: '2px',
          flex: 1,
          padding: '7px 4px',
          borderRadius: '9999px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-primary)',
          fontFamily: 'inherit',
          transition: 'all 0.25s ease',
        }}
        className="dock-tab-item"
        aria-label="Switch Language"
      >
        <span className="material-symbols-outlined dock-icon" style={{ fontSize: '22px' }}>
          translate
        </span>
        <span style={{ fontSize: '0.66rem', fontWeight: 800 }}>
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
