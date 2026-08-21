'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';
import QuickControlHub from './QuickControlHub';

function HeaderContent() {
  const { language, setLanguage, t } = useLanguage();
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [eyeComfort, setEyeComfort] = useState<'off' | 'warm' | 'night'>('off');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get('type');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ slug: string; type: 'movie' | 'series'; title: string; poster: string; audioLanguages: string[] }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize and apply Eye Comfort mode on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ap_eye_comfort') as 'off' | 'warm' | 'night';
      if (saved && (saved === 'warm' || saved === 'night')) {
        setEyeComfort(saved);
        if (saved === 'warm') document.documentElement.classList.add('eye-comfort-warm');
        if (saved === 'night') document.documentElement.classList.add('eye-comfort-night');
      }
    } catch (e) {}
  }, []);

  const cycleEyeComfort = () => {
    sound.playTabSwitch();
    let nextMode: 'off' | 'warm' | 'night' = 'off';
    if (eyeComfort === 'off') nextMode = 'warm';
    else if (eyeComfort === 'warm') nextMode = 'night';
    else nextMode = 'off';

    setEyeComfort(nextMode);
    document.documentElement.classList.remove('eye-comfort-warm', 'eye-comfort-night');
    if (nextMode === 'warm') document.documentElement.classList.add('eye-comfort-warm');
    if (nextMode === 'night') document.documentElement.classList.add('eye-comfort-night');
    try {
      localStorage.setItem('ap_eye_comfort', nextMode);
    } catch (e) {}
  };

  const isHome = pathname === '/' && !currentType;
  const isBrowse = pathname === '/browse' && !currentType;
  const isSeries = (pathname === '/browse' && currentType === 'series') || (pathname === '/' && currentType === 'series');
  const isMovies = (pathname === '/browse' && currentType === 'movies') || (pathname === '/' && currentType === 'movies');

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) setResults(await response.json());
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* Left: Brand Logo */}
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          zIndex: 2,
          flexShrink: 0,
          minWidth: 0,
        }}>
          {/* 3D Liquid Glass AP Icon */}
          <div className="header-logo-icon">
            <img 
              src="/logo.png?v=ap5" 
              alt="Anime Pakistan (AP) Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <span style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.12rem)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'var(--color-primary)',
              lineHeight: 1,
            }}>
              ANIME
            </span>
            <span className="brand-pakistan-text" style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.12rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}>
              PAKISTAN
            </span>
            {/* AP Badge with A Green, P White */}
            <span style={{
              fontSize: '0.60rem',
              fontWeight: 900,
              padding: '2px 5px',
              borderRadius: '4px',
              background: '#02180d',
              border: '1px solid rgba(0, 204, 102, 0.4)',
              boxShadow: '0 2px 6px rgba(0, 102, 51, 0.25)',
              marginLeft: '2px',
              display: 'inline-flex',
              alignItems: 'center',
              letterSpacing: '0.04em',
              flexShrink: 0,
              lineHeight: 1,
            }}>
              <span style={{ color: '#00ff66' }}>A</span>
              <span style={{ color: '#ffffff' }}>P</span>
            </span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Bar in Center */}
        <nav className="desktop-center-nav">
          <Link 
            href="/" 
            onClick={() => sound.playTabSwitch()}
            className={`desktop-nav-link ${isHome ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>home</span>
            <span style={{ lineHeight: 1 }}>{t('home')}</span>
          </Link>

          <Link 
            href="/browse" 
            onClick={() => sound.playTabSwitch()}
            className={`desktop-nav-link ${isBrowse ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>apps</span>
            <span style={{ lineHeight: 1 }}>{t('browse')}</span>
          </Link>

          <Link 
            href="/browse?type=series" 
            onClick={() => sound.playTabSwitch()}
            className={`desktop-nav-link ${isSeries ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>live_tv</span>
            <span style={{ lineHeight: 1 }}>{t('series')}</span>
          </Link>

          <Link 
            href="/browse?type=movies" 
            onClick={() => sound.playTabSwitch()}
            className={`desktop-nav-link ${isMovies ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>movie</span>
            <span style={{ lineHeight: 1 }}>{t('movies')}</span>
          </Link>
        </nav>

        {/* Right: Quick Search & Unified Quick Control Hub */}
        <div className="header-right-controls">
          {/* Quick Search Circular Icon Button */}
          <button
            type="button"
            className="header-action-btn"
            onClick={() => {
              setIsSearchOpen(true);
              sound.playButton();
            }}
            style={{
              background: '#ffffff',
              border: '1.5px solid var(--glass-border)',
              color: 'var(--color-primary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            aria-label="Search Anime"
            title="Search Anime"
          >
            <span className="material-symbols-outlined header-btn-icon">search</span>
          </button>

          {/* Unified Liquid Glass Quick Control Hub */}
          <QuickControlHub />
        </div>
      </div>

      {isSearchOpen && typeof document !== 'undefined' && createPortal(
        <>
          <button type="button" className="mobile-search-backdrop" onClick={closeSearch} aria-label="Close search" />
          <div className="mobile-search-panel" role="dialog" aria-modal="true" aria-label="Search anime">
          <div className="mobile-search-input-wrap">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>search</span>
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search anime, movies or genres..."
              aria-label="Search anime"
            />
            <button type="button" onClick={closeSearch} aria-label="Close search">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {query.trim().length >= 2 && (
            <div className="mobile-search-results" aria-live="polite">
              {isSearching && <p>Searching…</p>}
              {!isSearching && results.length === 0 && <p>No anime found. Try another title.</p>}
              {results.map((result) => (
                <Link key={`${result.type}-${result.slug}`} href={result.type === 'movie' ? `/watch/${result.slug}` : `/anime/${result.slug}`} onClick={closeSearch} className="mobile-search-result">
                  {result.poster ? <img src={result.poster} alt="" /> : <span className="material-symbols-outlined">movie</span>}
                  <span>
                    <strong>{result.title}</strong>
                    <small>{result.type === 'movie' ? 'Movie' : 'Series'}{result.audioLanguages.length ? ` · ${result.audioLanguages.slice(0, 2).join(', ')}` : ''}</small>
                  </span>
                </Link>
              ))}
            </div>
          )}
          </div>
        </>,
        document.body,
      )}

      <style jsx>{`
        .mobile-search-panel {
          display: none;
        }
        @media (max-width: 500px) {
          .brand-subtitle {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .site-header {
            top: calc(10px + var(--sat, 0px)) !important;
            margin: 0 14px 10px;
            border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
            border-radius: 28px !important;
            background: rgba(255, 255, 255, 0.78) !important;
            box-shadow: 0 16px 36px -4px rgba(0, 70, 35, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 2px rgba(255, 255, 255, 1) !important;
          }
          .site-header-inner {
            height: 62px !important;
            padding: 0 12px !important;
          }
          .mobile-search-panel {
            display: block;
            position: fixed;
            z-index: 1000;
            top: calc(82px + var(--sat, 0px));
            left: 14px;
            right: 14px;
            padding: 10px;
            border: 1.5px solid rgba(255, 255, 255, 0.9);
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(30px) saturate(210%);
            -webkit-backdrop-filter: blur(30px) saturate(210%);
            box-shadow: 0 16px 36px -4px rgba(0, 70, 35, 0.18), inset 0 1px 2px #fff;
          }
          .mobile-search-input-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 6px 4px 12px;
            border: 1px solid rgba(0, 102, 51, 0.16);
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.82);
          }
          .mobile-search-input-wrap input {
            flex: 1;
            min-width: 0;
            padding: 10px 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--text-primary);
            font: inherit;
          }
          .mobile-search-input-wrap button {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border: 0;
            border-radius: 12px;
            background: rgba(0, 102, 51, 0.1);
            color: var(--color-primary);
          }
          .mobile-search-results {
            display: grid;
            gap: 6px;
            max-height: min(52vh, 380px);
            margin-top: 8px;
            overflow-y: auto;
          }
          .mobile-search-results p {
            padding: 14px 10px;
            color: var(--text-secondary);
            font-size: 0.88rem;
          }
          .mobile-search-result {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.72);
          }
          .mobile-search-result img, .mobile-search-result > .material-symbols-outlined {
            width: 38px;
            height: 52px;
            border-radius: 9px;
            object-fit: cover;
            background: var(--bg-tertiary);
            color: var(--color-primary);
          }
          .mobile-search-result > .material-symbols-outlined {
            display: grid;
            place-items: center;
          }
          .mobile-search-result span { display: grid; gap: 3px; }
          .mobile-search-result strong { font-size: 0.86rem; color: var(--text-primary); }
          .mobile-search-result small { font-size: 0.72rem; color: var(--text-muted); }
        }
      `}</style>
    </header>
  );
}

export default function Header() {
  return (
    <Suspense fallback={<header style={{ height: '72px' }} />}>
      <HeaderContent />
    </Suspense>
  );
}
