'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';
import QuickControlHub from './QuickControlHub';

interface SearchResultItem {
  slug: string;
  type: 'movie' | 'series';
  title: string;
  poster: string;
  year?: number;
  rating?: string | number | null;
  audioLanguages: string[];
  genres?: string[];
}

function HeaderContent() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [eyeComfort, setEyeComfort] = useState<'off' | 'warm' | 'night'>('off');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get('type');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    sound.playButton();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice(language === 'ur' ? 'آواز کی تلاش کروم براؤزر پر دستیاب ہے' : 'Voice search is supported on Chrome & Android');
      setTimeout(() => setVoiceNotice(null), 3500);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = language === 'ur' ? 'ur-PK' : 'en-PK';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        const cleaned = transcript.replace(/\.+$/g, '').trim();
        setQuery(cleaned);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setVoiceNotice(language === 'ur' ? 'مائیکروفون کی اجازت درکار ہے' : 'Microphone permission needed');
      setTimeout(() => setVoiceNotice(null), 3500);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

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

  // Auto-detect and open shared library if ?share=CODE query parameter is present
  useEffect(() => {
    const shareCode = searchParams.get('share');
    if (shareCode) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ap_open_share_hub', { detail: { code: shareCode } }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

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
      setSearchError(false);
      setSelectedIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setResults(Array.isArray(data) ? data : []);
          setSelectedIndex(-1);
        } else {
          setResults([]);
          setSearchError(true);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
          setSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      const target = (selectedIndex >= 0 && selectedIndex < results.length) ? results[selectedIndex] : results[0];
      closeSearch();
      router.push(target.type === 'movie' ? `/watch/${target.slug}` : `/anime/${target.slug}`);
    } else if (query.trim().length >= 2) {
      closeSearch();
      router.push('/browse');
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setSearchError(false);
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
              padding: '2px 7px',
              borderRadius: '999px',
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
              background: 'var(--bg-secondary)',
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
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} className="mobile-search-input-wrap">
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px', flexShrink: 0 }}>
                search
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? (language === 'ur' ? "سن رہا ہے... بولیں" : "Listening... Speak now") : (language === 'ur' ? "اینیمی، موویز یا صنف تلاش کریں..." : "Search anime, movies, genres...")}
                aria-label="Search anime"
                autoComplete="off"
                spellCheck="false"
              />
              <div className="search-input-actions">
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setResults([]);
                      setSelectedIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    title="Clear"
                    className="search-clear-btn"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                )}

                {/* Mic Button */}
                <button 
                  type="button" 
                  onClick={startVoiceSearch} 
                  className={`search-mic-btn ${isListening ? 'listening' : ''}`}
                  title={isListening ? "Listening..." : "Voice Search"}
                  aria-label="Voice Search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {isListening ? 'mic' : 'mic_none'}
                  </span>
                </button>

                <button 
                  type="button" 
                  onClick={closeSearch} 
                  aria-label="Close search"
                  className="search-close-panel-btn"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            </form>

            {voiceNotice && (
              <div className="voice-notice-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                <span>{voiceNotice}</span>
              </div>
            )}

            {/* When user hasn't typed enough characters, show trending quick-picks */}
            {query.trim().length < 2 && (
              <div className="search-suggestions-box">
                <div className="search-suggestions-header">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#00ff88' }}>trending_up</span>
                  <span>{language === 'ur' ? 'مشہور اینیمی' : 'Popular Searches'}</span>
                </div>
                <div className="search-pills-row">
                  {['Naruto', 'One Piece', 'Ben 10', 'Attack on Titan', 'Demon Slayer', 'Solo Leveling'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="search-tag-pill"
                      onClick={() => setQuery(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results Section */}
            {query.trim().length >= 2 && (
              <div className="mobile-search-results" aria-live="polite">
                {isSearching && (
                  <div className="search-loading-skeleton">
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                  </div>
                )}

                {!isSearching && searchError && (
                  <div className="search-state-msg">
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#ef4444' }}>wifi_off</span>
                    <p>{language === 'ur' ? 'کنکشن کی خرابی۔ براہ کرم دوبارہ کوشش کریں۔' : 'Search connection error. Please try again.'}</p>
                  </div>
                )}

                {!isSearching && !searchError && results.length === 0 && (
                  <div className="search-state-msg">
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>search_off</span>
                    <p>
                      {language === 'ur' 
                        ? `"${query}" کا کوئی اینیمی نہیں ملا۔ دوسرا عنوان آزمائیں۔` 
                        : `No results found for "${query}". Try another title.`}
                    </p>
                    <Link href="/browse" onClick={closeSearch} className="search-browse-all-btn">
                      <span>{language === 'ur' ? 'تمام اینیمی دیکھیں' : 'Browse Full Catalog'}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </Link>
                  </div>
                )}

                {!isSearching && results.map((result, idx) => (
                  <Link 
                    key={`${result.type}-${result.slug}`} 
                    href={result.type === 'movie' ? `/watch/${result.slug}` : `/anime/${result.slug}`} 
                    onClick={closeSearch} 
                    className={`mobile-search-result ${idx === selectedIndex ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {result.poster ? (
                      <img src={result.poster} alt="" loading="lazy" />
                    ) : (
                      <span className="material-symbols-outlined">movie</span>
                    )}
                    <div className="search-result-info">
                      <strong className="search-result-title">{result.title}</strong>
                      <div className="search-result-tags">
                        <span className={`search-badge ${result.type}`}>
                          {result.type === 'movie' ? 'Movie' : 'Series'}
                        </span>
                        {result.rating && (
                          <span className="search-badge rating">
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>star</span>
                            {result.rating}
                          </span>
                        )}
                        {result.year && (
                          <span className="search-badge year">{result.year}</span>
                        )}
                        {result.audioLanguages?.length > 0 && (
                          <span className="search-badge lang">
                            {result.audioLanguages.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="material-symbols-outlined search-item-arrow">
                      chevron_right
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
        @keyframes pulse-mic {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes search-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes search-pop-in {
          from { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .mobile-search-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 99998;
          border: 0;
          cursor: pointer;
          animation: search-fade-in 0.18s ease;
        }
        .mobile-search-panel {
          display: block;
          position: fixed;
          z-index: 99999;
          top: 76px;
          left: 50%;
          transform: translateX(-50%);
          width: min(600px, calc(100vw - 28px));
          padding: 14px;
          border: 1.5px solid var(--glass-border);
          border-radius: 22px;
          background: var(--glass-bg);
          backdrop-filter: blur(36px) saturate(210%);
          -webkit-backdrop-filter: blur(36px) saturate(210%);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65), 0 0 24px rgba(0, 204, 102, 0.12);
          animation: search-pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-search-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px 6px 16px;
          border: 1.5px solid var(--glass-border);
          border-radius: 999px;
          background: var(--bg-secondary);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .mobile-search-input-wrap:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(0, 204, 102, 0.22);
        }
        .mobile-search-input-wrap input {
          flex: 1;
          min-width: 0;
          padding: 8px 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text-primary);
          font: inherit;
          font-size: 0.96rem;
          font-weight: 500;
        }
        .search-input-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .search-clear-btn, .search-mic-btn, .search-close-panel-btn {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.18s;
        }
        .search-clear-btn:hover, .search-close-panel-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: var(--text-primary);
        }
        .search-mic-btn {
          color: var(--color-primary);
          background: rgba(0, 204, 102, 0.1);
        }
        .search-mic-btn.listening {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
          animation: pulse-mic 1.4s infinite;
        }
        .voice-notice-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 204, 102, 0.12);
          border: 1px solid rgba(0, 204, 102, 0.25);
          color: #00ff88;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .search-suggestions-box {
          margin-top: 12px;
          padding: 10px 4px 4px;
        }
        .search-suggestions-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .search-pills-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .search-tag-pill {
          padding: 6px 14px;
          border-radius: 999px;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          font-size: 0.80rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.16s ease;
        }
        .search-tag-pill:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
          transform: translateY(-1px);
        }
        .mobile-search-results {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: min(62vh, 460px);
          margin-top: 10px;
          overflow-y: auto;
          padding-right: 2px;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .search-loading-skeleton {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 6px 0;
        }
        .skeleton-row {
          height: 60px;
          border-radius: 18px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.04) 25%, rgba(255, 255, 255, 0.09) 50%, rgba(255, 255, 255, 0.04) 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
        }
        .search-state-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          text-align: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 0.88rem;
        }
        .search-browse-all-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--color-primary);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.16s ease;
        }
        .search-browse-all-btn:hover {
          transform: translateY(-2px);
        }
        .mobile-search-result {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 18px;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          text-decoration: none;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .mobile-search-result:hover, .mobile-search-result.selected {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
          transform: translateX(-2px);
        }
        .mobile-search-result img, .mobile-search-result > .material-symbols-outlined {
          width: 44px;
          height: 58px;
          border-radius: 12px;
          object-fit: cover;
          background: var(--bg-tertiary);
          color: var(--color-primary);
          flex-shrink: 0;
        }
        .mobile-search-result > .material-symbols-outlined {
          display: grid;
          place-items: center;
        }
        .search-result-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .search-result-title {
          font-size: 0.90rem;
          font-weight: 700;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .search-result-tags {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .search-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        .search-badge.series {
          background: rgba(0, 204, 102, 0.15);
          color: #00ff88;
          border: 0.5px solid rgba(0, 204, 102, 0.3);
        }
        .search-badge.movie {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 0.5px solid rgba(16, 185, 129, 0.3);
        }
        .search-badge.rating {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .search-badge.year {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
        }
        .search-badge.lang {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
        }
        .search-item-arrow {
          font-size: 18px;
          color: var(--text-muted);
          margin-inline-start: auto;
          flex-shrink: 0;
          opacity: 0.6;
        }
        @media (max-width: 500px) {
          .brand-subtitle {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .site-header {
            top: calc(10px + var(--sat, 0px)) !important;
            margin: 0 auto 10px !important;
            width: calc(100% - 24px) !important;
            border: 1.5px solid var(--glass-border) !important;
            border-radius: 26px !important;
            background: var(--glass-bg) !important;
            box-shadow: var(--glass-shadow) !important;
          }
          .site-header-inner {
            height: 58px !important;
            padding: 0 12px !important;
          }
          .mobile-search-panel {
            top: calc(76px + var(--sat, 0px));
            left: 10px;
            right: 10px;
            transform: none;
            width: auto;
            border-radius: 20px;
          }
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
