'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';
import { getWatchHistory, removeWatchItem, clearWatchHistory, formatTimeSeconds, formatRelativeTime, WatchProgressItem } from '@/lib/watchHistory';
import { getWatchlist, WatchlistItem } from '@/lib/watchlist';
import { getProxiedImageUrl } from '@/lib/image';

export default function QuickControlHub() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [eyeComfort, setEyeComfort] = useState<'off' | 'warm' | 'night'>('off');
  const [historyItems, setHistoryItems] = useState<WatchProgressItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'watchlist'>('settings');
  const [historySearch, setHistorySearch] = useState('');

  const hubRef = useRef<HTMLDivElement>(null);

  // Initialize on mount and maintain active sync
  useEffect(() => {
    const refreshData = () => {
      setHistoryItems(getWatchHistory());
      setWatchlistItems(getWatchlist());
    };

    // Immediate sync on load
    refreshData();

    try {
      const savedEye = localStorage.getItem('ap_eye_comfort') as 'off' | 'warm' | 'night';
      if (savedEye && (savedEye === 'warm' || savedEye === 'night')) {
        setEyeComfort(savedEye);
        if (savedEye === 'warm') document.documentElement.classList.add('eye-comfort-warm');
        if (savedEye === 'night') document.documentElement.classList.add('eye-comfort-night');
      }
    } catch (e) {}

    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (hubRef.current && !hubRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('ap_history_updated', refreshData);
    window.addEventListener('storage', refreshData);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('ap_history_updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, []);

  // When dropdown opens, do a fresh sync
  useEffect(() => {
    if (isOpen) {
      setHistoryItems(getWatchHistory());
      setWatchlistItems(getWatchlist());
    }
  }, [isOpen]);

  const toggleSound = () => {
    const next = !isSoundOn;
    setIsSoundOn(next);
    sound.setEnabled(next);
    if (next) sound.playButton();
  };

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

  const isUrdu = language === 'ur';

  return (
    <div className="quick-hub-container" ref={hubRef} style={{ position: 'relative', zIndex: 9999 }}>
      {/* Unified Single Navbar Quick Settings Icon Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          sound.playButton();
        }}
        className="header-action-btn"
        style={{
          background: isOpen ? 'rgba(0, 102, 51, 0.12)' : '#ffffff',
          border: isOpen ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
          color: isOpen ? 'var(--color-primary)' : 'var(--text-primary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
        }}
        title={isUrdu ? 'سیٹنگز اور کنٹرولز' : 'Settings & Controls'}
        aria-label="Settings & Controls"
      >
        <span 
          className="material-symbols-outlined header-btn-icon" 
          style={{ 
            color: isOpen ? 'var(--color-primary)' : 'inherit',
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(90deg)' : 'none',
          }}
        >
          settings
        </span>
      </button>

      {/* Floating Liquid Glass Control Hub Popover */}
      {isOpen && (
        <div
          className="quick-hub-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: isUrdu ? 'auto' : 0,
            left: isUrdu ? 0 : 'auto',
            width: 'min(340px, 92vw)',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1.5px solid rgba(0, 102, 51, 0.2)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px -8px rgba(0, 70, 35, 0.24), 0 8px 20px rgba(0, 0, 0, 0.08)',
            padding: '16px',
            animation: 'hubPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            direction: isUrdu ? 'rtl' : 'ltr',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                widgets
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {isUrdu ? 'کوئیک کنٹرول ہب' : 'Quick Control Hub'}
              </span>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(0, 102, 51, 0.07)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Hub Navigation Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '4px',
            background: 'rgba(0, 102, 51, 0.06)',
            padding: '3px',
            borderRadius: '10px',
            marginBottom: '14px',
          }}>
            <button
              onClick={() => {
                setActiveTab('settings');
                sound.playTabSwitch();
              }}
              style={{
                padding: '6px 4px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'settings' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'settings' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {isUrdu ? 'سیٹنگز' : 'Settings'}
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                sound.playTabSwitch();
              }}
              style={{
                padding: '6px 4px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {isUrdu ? `جاری (${historyItems.length})` : `History (${historyItems.length})`}
            </button>

            <button
              onClick={() => {
                setActiveTab('watchlist');
                sound.playTabSwitch();
              }}
              style={{
                padding: '6px 4px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'watchlist' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'watchlist' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {isUrdu ? `فہرست (${watchlistItems.length})` : `My List (${watchlistItems.length})`}
            </button>
          </div>

          {/* TAB 1: Settings Grid (Language, Eye Comfort, Sound) */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Language Switch Tile */}
              <div 
                onClick={() => {
                  setLanguage(language === 'ur' ? 'en' : 'ur');
                  sound.playTabSwitch();
                }}
                className="hub-glass-tile"
                style={{
                  gridColumn: 'span 2',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                    translate
                  </span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {isUrdu ? 'ویب سائٹ کی زبان' : 'App Language'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {language === 'ur' ? 'اردو (Urdu)' : 'English (EN)'}
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                }}>
                  {language === 'ur' ? 'EN میں بدلیں' : 'اردو میں بدلیں'}
                </span>
              </div>

              {/* Eye Comfort Mode Tile */}
              <div 
                onClick={cycleEyeComfort}
                className="hub-glass-tile"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: eyeComfort === 'warm' ? 'rgba(217, 119, 6, 0.08)' : eyeComfort === 'night' ? 'rgba(0, 204, 102, 0.08)' : '#ffffff',
                  border: eyeComfort === 'warm' ? '1.5px solid #d97706' : eyeComfort === 'night' ? '1.5px solid var(--color-glow)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: '18px', 
                    color: eyeComfort === 'warm' ? '#d97706' : eyeComfort === 'night' ? '#00aa55' : 'var(--text-secondary)' 
                  }}>
                    {eyeComfort === 'night' ? 'bedtime' : 'visibility'}
                  </span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: eyeComfort === 'warm' ? '#d97706' : eyeComfort === 'night' ? '#00aa55' : 'rgba(0,0,0,0.06)',
                    color: eyeComfort !== 'off' ? '#ffffff' : 'var(--text-muted)',
                  }}>
                    {eyeComfort === 'warm' ? 'Amber' : eyeComfort === 'night' ? 'OLED' : 'Off'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isUrdu ? 'آنکھوں کا آرام' : 'Eye Comfort'}
                </div>
              </div>

              {/* UI Sound Effects Tile */}
              <div 
                onClick={toggleSound}
                className="hub-glass-tile"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: isSoundOn ? 'rgba(0, 102, 51, 0.08)' : '#ffffff',
                  border: isSoundOn ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: '18px', 
                    color: isSoundOn ? 'var(--color-primary)' : 'var(--text-muted)' 
                  }}>
                    {isSoundOn ? 'volume_up' : 'volume_off'}
                  </span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isSoundOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)',
                    color: isSoundOn ? '#ffffff' : 'var(--text-muted)',
                  }}>
                    {isSoundOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isUrdu ? 'کلک ساؤنڈز' : 'UI Audio FX'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Complete Watch History List with Full Info */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Optional Search Filter if user has multiple history items */}
              {historyItems.length > 2 && (
                <div style={{ position: 'relative', marginBottom: '2px' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute',
                    left: isUrdu ? 'auto' : '8px',
                    right: isUrdu ? '8px' : 'auto',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px',
                    color: 'var(--text-muted)',
                  }}>
                    search
                  </span>
                  <input
                    type="text"
                    placeholder={isUrdu ? 'ہسٹری میں تلاش کریں...' : 'Search watch history...'}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: isUrdu ? '6px 28px 6px 8px' : '6px 8px 6px 28px',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      background: '#ffffff',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* History Items Scroll Area (Shows ALL history items with full details) */}
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '2px',
              }}>
                {historyItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-primary)', display: 'block', marginBottom: '8px', opacity: 0.6 }}>
                      history_toggle_off
                    </span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {isUrdu ? 'کوئی ہسٹری موجود نہیں ہے' : 'No watch history yet'}
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      {isUrdu ? 'جب آپ کوئی اینیمی دیکھیں گے تو وہ یہاں دکھائی دے گا۔' : 'Episodes and movies you watch will appear right here.'}
                    </div>
                  </div>
                ) : (
                  historyItems
                    .filter((item) => {
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase().trim();
                      return item.animeTitle.toLowerCase().includes(q) || (item.epTitle || '').toLowerCase().includes(q);
                    })
                    .map((item) => {
                      const watchUrl = item.type === 'movie'
                        ? `/watch/${item.animeSlug}`
                        : (item.epSlug ? `/watch/${item.animeSlug}/${item.epSlug}` : `/watch/${item.animeSlug}`);

                      const cleanEpTitle = item.epTitle
                        ? item.epTitle.replace(/S\d+E\d+.*$/i, '').replace(/1080p.*$/i, '').replace(/\.mkv|\.mp4/gi, '').trim()
                        : (item.type === 'movie' ? (isUrdu ? 'مکمل مووی' : 'Full Movie') : `Episode ${item.epNumber || 1}`);

                      const posterSrc = getProxiedImageUrl(item.poster || item.backdrop || '');

                      return (
                        <div
                          key={item.animeSlug}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#ffffff',
                            border: '1.2px solid var(--glass-border)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 3px 10px rgba(0, 70, 35, 0.05)',
                            position: 'relative',
                            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                            {/* Poster / Thumbnail with Progress Overlay */}
                            <Link
                              href={watchUrl}
                              onClick={() => {
                                setIsOpen(false);
                                sound.playEpisodeSelect();
                              }}
                              style={{
                                width: '48px',
                                height: '62px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                position: 'relative',
                                flexShrink: 0,
                                background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
                                textDecoration: 'none',
                                display: 'block',
                              }}
                            >
                              {posterSrc ? (
                                <img 
                                  src={posterSrc} 
                                  alt={item.animeTitle} 
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_circle</span>
                                </div>
                              )}
                              <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0, 0, 0, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffffff' }}>
                                  play_arrow
                                </span>
                              </div>
                            </Link>

                            {/* Info Column */}
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 800,
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: item.type === 'movie' ? '#006633' : '#059669',
                                  color: '#ffffff',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.02em',
                                  lineHeight: 1.2,
                                }}>
                                  {item.type === 'movie' ? 'Movie' : `EP ${item.epNumber || 1}`}
                                </span>
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  color: 'var(--text-muted)',
                                }}>
                                  {formatRelativeTime(item.updatedAt, isUrdu)}
                                </span>
                              </div>

                              <Link
                                href={watchUrl}
                                onClick={() => {
                                  setIsOpen(false);
                                  sound.playEpisodeSelect();
                                }}
                                style={{
                                  fontSize: '0.80rem',
                                  fontWeight: 800,
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.2,
                                }}
                              >
                                {item.animeTitle}
                              </Link>

                              <div style={{
                                fontSize: '0.68rem',
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                marginTop: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {cleanEpTitle}
                              </div>

                              {/* Time watched / duration badge */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.62rem',
                                color: 'var(--text-muted)',
                                marginTop: '3px',
                              }}>
                                <span style={{ fontWeight: 600 }}>
                                  {formatTimeSeconds(item.currentTime)} / {formatTimeSeconds(item.duration)} ({item.progressPercent}%)
                                </span>
                              </div>
                            </div>

                            {/* Resume & Delete Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <Link
                                href={watchUrl}
                                onClick={() => {
                                  setIsOpen(false);
                                  sound.playEpisodeSelect();
                                }}
                                title={isUrdu ? 'دوبارہ چلائیں' : 'Resume'}
                                style={{
                                  background: 'rgba(0, 102, 51, 0.1)',
                                  borderRadius: '6px',
                                  width: '26px',
                                  height: '26px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--color-primary)',
                                  textDecoration: 'none',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
                              </Link>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeWatchItem(item.animeSlug);
                                  sound.playButton();
                                }}
                                title={isUrdu ? 'ہسٹری سے ہٹائیں' : 'Remove from history'}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  width: '26px',
                                  height: '26px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Emerald Progress Line along card bottom */}
                          <div style={{ width: '100%', height: '3.5px', background: 'rgba(0, 102, 51, 0.08)' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.max(4, Math.min(100, item.progressPercent))}%`,
                              background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-glow) 100%)',
                              boxShadow: '0 0 6px rgba(0, 204, 102, 0.4)',
                            }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Clear All History Action */}
              {historyItems.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--glass-border)',
                }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {historyItems.length} {isUrdu ? 'آئٹمز' : 'items saved'}
                  </span>

                  <button
                    onClick={() => {
                      if (window.confirm(isUrdu ? 'کیا آپ تمام واچ ہسٹری صاف کرنا چاہتے ہیں؟' : 'Clear all watch history?')) {
                        clearWatchHistory();
                        sound.playButton();
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete_sweep</span>
                    <span>{isUrdu ? 'تمام ہسٹری صاف کریں' : 'Clear All History'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: My Watchlist */}
          {activeTab === 'watchlist' && (
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {watchlistItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {isUrdu ? 'فہرست میں کوئی اینیمے شامل نہیں ہے' : 'No saved anime in your list'}
                </div>
              ) : (
                watchlistItems.map((item) => (
                  <Link
                    key={item.slug}
                    href={item.type === 'movie' ? `/watch/${item.slug}` : `/anime/${item.slug}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid var(--glass-border)',
                      textDecoration: 'none',
                    }}
                  >
                    <img 
                      src={item.poster} 
                      alt="" 
                      style={{ width: '32px', height: '42px', borderRadius: '4px', objectFit: 'cover' }} 
                    />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {item.type}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes hubPop {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .hub-glass-tile:hover {
          background: rgba(0, 102, 51, 0.05) !important;
          border-color: var(--color-primary) !important;
        }
      `}</style>
    </div>
  );
}
