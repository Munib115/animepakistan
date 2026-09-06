'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';
import { getWatchHistory, removeWatchItem, clearWatchHistory, formatTimeSeconds, formatRelativeTime, WatchProgressItem } from '@/lib/watchHistory';
import { getWatchlist, WatchlistItem } from '@/lib/watchlist';
import { getProxiedImageUrl } from '@/lib/image';
import {
  publishMyLibrary,
  fetchLibraryByCode,
  applySharedLibrary,
  getSavedMyShareCode,
  SharedLibraryRecord,
} from '@/lib/shareLibrary';
import { adblockShield, ShieldStats, formatTimeSaved } from '@/lib/adblockShield';

export default function QuickControlHub() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [eyeComfort, setEyeComfort] = useState<'off' | 'warm' | 'night'>('off');
  const [isAdBlockOn, setIsAdBlockOn] = useState(true);
  const [shieldStats, setShieldStats] = useState<ShieldStats>({
    adsBlocked: 0,
    popupsBlocked: 0,
    trackersBlocked: 0,
    bandwidthSavedMB: 0,
    timeSavedSec: 0,
  });
  const [historyItems, setHistoryItems] = useState<WatchProgressItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'watchlist' | 'share'>('settings');
  const [historySearch, setHistorySearch] = useState('');

  // Share Library State
  const [myShareCode, setMyShareCode] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  // Import Friend Library State
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [isLoadingFriend, setIsLoadingFriend] = useState(false);
  const [friendLibrary, setFriendLibrary] = useState<SharedLibraryRecord | null>(null);
  const [friendFetchError, setFriendFetchError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const hubRef = useRef<HTMLDivElement>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setShareFeedback(null);
    sound.playButton();
    try {
      const res = await publishMyLibrary();
      if (res.error || !res.shareCode) {
        setShareFeedback(res.error || 'Failed to generate share code.');
      } else {
        setMyShareCode(res.shareCode);
        setShareFeedback(isUrdu ? 'کوڈ کامیابی سے تیار ہو گیا ہے!' : 'Library synced & code generated!');
        sound.playEpisodeSelect();
      }
    } catch (err: any) {
      setShareFeedback(err.message || 'Error publishing library');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyCode = () => {
    if (!myShareCode) return;
    sound.playButton();
    try {
      navigator.clipboard.writeText(myShareCode);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = myShareCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!myShareCode) return;
    sound.playButton();
    const url = typeof window !== 'undefined' ? `${window.location.origin}/?share=${myShareCode}` : '';
    try {
      navigator.clipboard.writeText(url);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2000);
  };

  const handleLoadFriendLibrary = async (codeToSearch?: string) => {
    const code = (codeToSearch || friendCodeInput).trim().toUpperCase();
    if (!code) {
      setFriendFetchError(isUrdu ? 'براہ کرم کوڈ درج کریں' : 'Please enter a code');
      return;
    }
    setIsLoadingFriend(true);
    setFriendFetchError(null);
    setFriendLibrary(null);
    setImportSuccess(null);
    sound.playButton();
    try {
      const res = await fetchLibraryByCode(code);
      if (res.error || !res.data) {
        setFriendFetchError(res.error || (isUrdu ? 'کوڈ نہیں ملا، دوبارہ چیک کریں' : 'Library not found. Please check code.'));
      } else {
        setFriendLibrary(res.data);
        sound.playEpisodeSelect();
      }
    } catch (e: any) {
      setFriendFetchError(e.message || 'Failed to fetch library');
    } finally {
      setIsLoadingFriend(false);
    }
  };

  const handleApplyLibrary = (mode: 'merge' | 'replace') => {
    if (!friendLibrary) return;
    sound.playButton();
    const result = applySharedLibrary(friendLibrary, mode);
    setImportSuccess(
      isUrdu
        ? `لائبریری کامیابی سے حاصل ہو گئی (${result.addedWatchlist} واچ لسٹ، ${result.addedHistory} ہسٹری)!`
        : `Imported successfully (${result.addedWatchlist} in list, ${result.addedHistory} in history)!`
    );
    sound.playEpisodeSelect();
    setWatchlistItems(getWatchlist());
    setHistoryItems(getWatchHistory());
  };

  // Initialize on mount and maintain active sync
  useEffect(() => {
    const refreshData = () => {
      setHistoryItems(getWatchHistory());
      setWatchlistItems(getWatchlist());
    };

    // Immediate sync on load
    refreshData();

    // Check for previously generated share code
    const savedCode = getSavedMyShareCode();
    if (savedCode) setMyShareCode(savedCode);

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

    // Listen for direct URL share trigger
    const handleOpenShare = (e: any) => {
      setIsOpen(true);
      setActiveTab('share');
      if (e.detail?.code) {
        setFriendCodeInput(e.detail.code);
        handleLoadFriendLibrary(e.detail.code);
      }
    };

    // AdBlocker sync
    setIsAdBlockOn(adblockShield.isEnabled());
    setShieldStats(adblockShield.getStats());

    const handleShieldStatsUpdate = () => {
      setShieldStats(adblockShield.getStats());
    };
    const handleShieldToggleEvent = () => {
      setIsAdBlockOn(adblockShield.isEnabled());
    };

    const handleOpenSettingsHub = () => {
      setIsOpen(true);
      setActiveTab('settings');
    };

    window.addEventListener('ap_adblock_stats_updated', handleShieldStatsUpdate);
    window.addEventListener('ap_adblock_changed', handleShieldToggleEvent);
    window.addEventListener('ap_open_settings_hub', handleOpenSettingsHub);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('ap_history_updated', refreshData);
    window.addEventListener('ap_watchlist_updated', refreshData);
    window.addEventListener('storage', refreshData);
    window.addEventListener('ap_open_share_hub', handleOpenShare);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('ap_history_updated', refreshData);
      window.removeEventListener('ap_watchlist_updated', refreshData);
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('ap_open_share_hub', handleOpenShare);
      window.removeEventListener('ap_open_settings_hub', handleOpenSettingsHub);
      window.removeEventListener('ap_adblock_stats_updated', handleShieldStatsUpdate);
      window.removeEventListener('ap_adblock_changed', handleShieldToggleEvent);
    };
  }, []);

  // When dropdown opens, do a fresh sync
  useEffect(() => {
    if (isOpen) {
      setHistoryItems(getWatchHistory());
      setWatchlistItems(getWatchlist());
      setShieldStats(adblockShield.getStats());
      setIsAdBlockOn(adblockShield.isEnabled());
    }
  }, [isOpen]);

  const toggleSound = () => {
    const next = !isSoundOn;
    setIsSoundOn(next);
    sound.setEnabled(next);
    if (next) sound.playButton();
  };

  const toggleAdBlock = () => {
    const next = !isAdBlockOn;
    adblockShield.setEnabled(next);
    setIsAdBlockOn(next);
    sound.click();
    sound.haptic(15);
  };

  const handleResetShieldStats = () => {
    adblockShield.resetStats();
    setShieldStats(adblockShield.getStats());
    sound.pop();
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
          background: isOpen ? 'rgba(0, 102, 51, 0.18)' : 'var(--bg-secondary)',
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

      {/* Mobile / Click-Outside Backdrop */}
      {isOpen && (
        <div
          className="quick-hub-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
            background: 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Floating Liquid Glass Control Hub Popover */}
      {isOpen && (
        <div
          className="quick-hub-popover glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: isUrdu ? 'auto' : 0,
            left: isUrdu ? 0 : 'auto',
            width: 'min(380px, 94vw)',
            maxHeight: 'calc(100dvh - 90px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1.5px solid var(--glass-border)',
            borderRadius: '18px',
            boxShadow: 'var(--glass-shadow)',
            padding: '12px 12px 6px 12px',
            animation: 'hubPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            direction: isUrdu ? 'rtl' : 'ltr',
            zIndex: 9999,
            boxSizing: 'border-box',
            overflow: 'hidden',
            color: 'var(--text-primary)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--glass-border)',
            flexShrink: 0,
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
          <div 
            className="quick-hub-tabs-container"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '3px',
              background: 'var(--bg-tertiary)',
              padding: '3px',
              borderRadius: '10px',
              marginBottom: '10px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                setActiveTab('settings');
                sound.playTabSwitch();
              }}
              className={`quick-hub-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'settings' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'settings' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {isUrdu ? 'سیٹنگز' : 'Settings'}
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                sound.playTabSwitch();
              }}
              className={`quick-hub-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {isUrdu ? `جاری (${historyItems.length})` : `History (${historyItems.length})`}
            </button>

            <button
              onClick={() => {
                setActiveTab('watchlist');
                sound.playTabSwitch();
              }}
              className={`quick-hub-tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'watchlist' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'watchlist' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {isUrdu ? `فہرست (${watchlistItems.length})` : `List (${watchlistItems.length})`}
            </button>

            <button
              onClick={() => {
                setActiveTab('share');
                sound.playTabSwitch();
              }}
              className={`quick-hub-tab-btn ${activeTab === 'share' ? 'active' : ''}`}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'share' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'share' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                share
              </span>
              {isUrdu ? 'شیئر' : 'Share'}
            </button>
          </div>

          {/* TAB 1: Settings Grid (Language, Eye Comfort, Sound) */}
          {activeTab === 'settings' && (
            <div
              className="quick-hub-scroll"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '16px',
              }}
            >
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
                  background: 'var(--bg-secondary)',
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

              {/* Theme & OLED Mode Tile */}
              <div 
                onClick={cycleEyeComfort}
                className="hub-glass-tile"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: eyeComfort === 'warm' ? 'rgba(217, 119, 6, 0.12)' : eyeComfort === 'night' ? 'rgba(0, 229, 117, 0.18)' : 'var(--bg-secondary)',
                  border: eyeComfort === 'warm' ? '1.5px solid #d97706' : eyeComfort === 'night' ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: '18px', 
                    color: eyeComfort === 'warm' ? '#d97706' : eyeComfort === 'night' ? 'var(--color-primary)' : 'var(--text-secondary)' 
                  }}>
                    {eyeComfort === 'night' ? 'dark_mode' : eyeComfort === 'warm' ? 'wb_sunny' : 'brightness_medium'}
                  </span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: eyeComfort === 'warm' ? '#d97706' : eyeComfort === 'night' ? 'var(--color-primary)' : 'rgba(0,0,0,0.08)',
                    color: eyeComfort === 'night' ? '#011508' : eyeComfort === 'warm' ? '#ffffff' : 'var(--text-muted)',
                  }}>
                    {eyeComfort === 'warm' ? (isUrdu ? 'ایمبر ورم' : 'Amber') : eyeComfort === 'night' ? (isUrdu ? 'OLED سیاہ' : 'OLED Black') : (isUrdu ? 'لائٹ' : 'Light')}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isUrdu ? 'تھیم اور نائٹ موڈ' : 'Theme & OLED'}
                </div>
              </div>

              {/* UI Sound Effects Tile */}
              <div 
                onClick={toggleSound}
                className="hub-glass-tile"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: isSoundOn ? 'rgba(0, 204, 102, 0.12)' : 'var(--bg-secondary)',
                  border: isSoundOn ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.2s ease',
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
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isSoundOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.08)',
                    color: isSoundOn ? '#ffffff' : 'var(--text-muted)',
                  }}>
                    {isSoundOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isUrdu ? 'کلک ساؤنڈز' : 'UI Audio FX'}
                </div>
              </div>

              {/* AdBlocker Box (Tile) */}
              <div 
                className="hub-glass-tile"
                style={{
                  gridColumn: 'span 2',
                  padding: '12px',
                  borderRadius: '14px',
                  background: isAdBlockOn ? 'linear-gradient(135deg, rgba(0, 102, 51, 0.12) 0%, rgba(0, 229, 117, 0.06) 100%)' : 'var(--bg-secondary)',
                  border: isAdBlockOn ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: isAdBlockOn ? '0 4px 16px rgba(0, 102, 51, 0.10)' : '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Header Row: Shield Icon, Title, Subtitle, and ON/OFF Switch */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isAdBlockOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.08)',
                      color: isAdBlockOn ? '#ffffff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isAdBlockOn ? '0 2px 8px rgba(0, 102, 51, 0.3)' : 'none',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {isAdBlockOn ? 'verified_user' : 'shield'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{isUrdu ? 'ایڈ بلاکر' : 'AdBlocker'}</span>
                        {isAdBlockOn && (
                          <span style={{
                            fontSize: '0.60rem',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'var(--color-primary)',
                            color: '#ffffff',
                          }}>
                            {isUrdu ? 'فعال' : 'ACTIVE'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                        {isUrdu ? 'پاپ اپس اور غیر ضروری اشتہارات کی خودکار روک تھام' : 'Stops unwanted popups & redirects during playback'}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Pill Switch */}
                  <button
                    type="button"
                    onClick={toggleAdBlock}
                    style={{
                      border: 'none',
                      background: isAdBlockOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.15)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      color: isAdBlockOn ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.70rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease',
                    }}
                    title={isAdBlockOn ? 'Disable AdBlocker' : 'Enable AdBlocker'}
                  >
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isAdBlockOn ? '#00ff88' : '#888888',
                      display: 'inline-block',
                      boxShadow: isAdBlockOn ? '0 0 6px #00ff88' : 'none',
                    }} />
                    <span>{isAdBlockOn ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                {/* Real-time Summary Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.18) 0%, rgba(0, 229, 117, 0.08) 100%)',
                  border: '1px solid rgba(0, 255, 102, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#00ff88' }}>
                      verified
                    </span>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {isUrdu 
                          ? `${shieldStats.adsBlocked + shieldStats.popupsBlocked} اشتہارات و پاپ اپس بلاک ہوئے`
                          : `${shieldStats.adsBlocked + shieldStats.popupsBlocked} Ads & Popups Blocked`}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                        {isUrdu
                          ? `${formatTimeSaved(shieldStats.timeSavedSec)} وقت اور ${shieldStats.bandwidthSavedMB} MB ڈیٹا بچایا گیا`
                          : `${formatTimeSaved(shieldStats.timeSavedSec)} Saved • ${shieldStats.bandwidthSavedMB} MB Data Saved`}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 255, 102, 0.15)',
                    border: '1px solid rgba(0, 255, 102, 0.3)',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    color: '#00ff88',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', display: 'inline-block', boxShadow: '0 0 6px #00ff88' }} />
                    <span>{isUrdu ? 'لائیو' : 'LIVE'}</span>
                  </div>
                </div>

                {/* 4-Card Statistics Grid with Icons & Large Numbers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  background: 'var(--bg-secondary)',
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {shieldStats.adsBlocked}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {isUrdu ? 'اشتہارات' : 'Ads Blocked'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {shieldStats.popupsBlocked}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {isUrdu ? 'پاپ اپس' : 'Popups'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {shieldStats.trackersBlocked}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {isUrdu ? 'ٹریکرز' : 'Trackers'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {formatTimeSaved(shieldStats.timeSavedSec)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {isUrdu ? 'وقت کی بچت' : 'Time Saved'}
                    </div>
                  </div>
                </div>

                {/* Reset Stats / Status Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                  <span>
                    {isAdBlockOn 
                      ? (isUrdu ? '✓ ویڈیو کلک کرنے پر پاپ اپس یا دوسری سائٹ نہیں کھلے گی' : '✓ Protected: Video clicks will not redirect or open ads')
                      : (isUrdu ? '⚠ ایڈ بلاکر بند ہے: پاپ اپس آ سکتے ہیں' : '⚠ AdBlocker off: Popups may open')}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetShieldStats}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    {isUrdu ? 'ری سیٹ' : 'Reset'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Complete Watch History List with Full Info */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, flex: '1 1 auto', overflow: 'hidden' }}>
              {/* Optional Search Filter if user has multiple history items */}
              {historyItems.length > 2 && (
                <div style={{ position: 'relative', marginBottom: '2px', flexShrink: 0 }}>
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
                    className="quick-hub-input"
                    style={{
                      width: '100%',
                      padding: isUrdu ? '6px 28px 6px 8px' : '6px 8px 6px 28px',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* History Items Scroll Area (Shows ALL history items with full details) */}
              <div 
                className="quick-hub-scroll"
                style={{
                  flex: '1 1 auto',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingRight: '4px',
                  paddingBottom: '20px',
                  minHeight: 0,
                }}
              >
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
                          className="quick-hub-card"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flexShrink: 0,
                            minHeight: '78px',
                            background: 'var(--bg-secondary)',
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
                  marginTop: '6px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--glass-border)',
                  flexShrink: 0,
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
            <div 
              className="quick-hub-scroll"
              style={{
                flex: '1 1 auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minHeight: 0,
                paddingRight: '4px',
                paddingBottom: '20px',
              }}
            >
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
                    className="quick-hub-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      minHeight: '52px',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
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

          {/* TAB 4: Share & Sync Library */}
          {activeTab === 'share' && (
            <div
              className="quick-hub-scroll"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingRight: '4px',
                paddingBottom: '24px',
              }}
            >
              {/* Top Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.08) 0%, rgba(20, 150, 80, 0.05) 100%)',
                  border: '1px solid rgba(0, 102, 51, 0.18)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
                    cloud_sync
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {isUrdu ? 'کلاؤڈ شیئر اور سنک' : 'Cloud Library Share'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.70rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {isUrdu
                    ? 'اپنا واچ لسٹ اور ہسٹری کلاؤڈ کوڈ کے ذریعے شیئر کریں، یا اپنے دوست کا کوڈ درج کر کے لائبریری حاصل کریں۔'
                    : 'Share your watchlist & history using a unique cloud code, or enter a friend\'s code to view their library.'}
                </p>
              </div>

              {/* SECTION 1: Share My Library Card */}
              <div
                className="quick-hub-card"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1.5px solid var(--glass-border)',
                  borderRadius: '14px',
                  padding: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
                      cloud_upload
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {isUrdu ? 'میری لائبریری شیئر کریں' : 'Share My Library'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'rgba(0, 102, 51, 0.08)',
                      color: 'var(--color-primary)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                    }}>
                      {watchlistItems.length} {isUrdu ? 'لسٹ' : 'list'}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'rgba(0, 102, 51, 0.08)',
                      color: 'var(--color-primary)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                    }}>
                      {historyItems.length} {isUrdu ? 'ہسٹری' : 'history'}
                    </span>
                  </div>
                </div>

                {!myShareCode ? (
                  <div>
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: isPublishing ? 'wait' : 'pointer',
                        opacity: isPublishing ? 0.7 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {isPublishing ? 'hourglass_top' : 'cloud_upload'}
                      </span>
                      {isPublishing
                        ? (isUrdu ? 'کوڈ بن رہا ہے...' : 'Generating Code...')
                        : (isUrdu ? 'شیئر کوڈ بنائیں' : 'Generate Share Code')}
                    </button>
                    {shareFeedback && (
                      <div style={{ marginTop: '6px', fontSize: '0.68rem', color: '#dc2626', textAlign: 'center' }}>
                        {shareFeedback}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Share Code Display Box */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 102, 51, 0.05)',
                        border: '1.5px dashed rgba(0, 102, 51, 0.3)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {isUrdu ? 'آپ کا کوڈ' : 'Your Share Code'}
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '2px', fontFamily: 'monospace' }}>
                          {myShareCode}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={handleCopyCode}
                          title={isUrdu ? 'کوڈ کاپی کریں' : 'Copy Code'}
                          style={{
                            background: isCopiedCode ? 'var(--color-primary)' : 'var(--bg-secondary)',
                            color: isCopiedCode ? '#ffffff' : 'var(--color-primary)',
                            border: '1px solid rgba(0, 102, 51, 0.2)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {isCopiedCode ? 'check' : 'content_copy'}
                          </span>
                          {isCopiedCode ? (isUrdu ? 'کاپی' : 'Copied!') : (isUrdu ? 'کاپی' : 'Copy')}
                        </button>
                        <button
                          onClick={handleCopyLink}
                          title={isUrdu ? 'لنک کاپی کریں' : 'Copy Link'}
                          style={{
                            background: isCopiedLink ? 'var(--color-primary)' : 'var(--bg-secondary)',
                            color: isCopiedLink ? '#ffffff' : 'var(--color-primary)',
                            border: '1px solid rgba(0, 102, 51, 0.2)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {isCopiedLink ? 'check' : 'link'}
                          </span>
                          {isCopiedLink ? (isUrdu ? 'لنک' : 'Linked!') : (isUrdu ? 'لنک' : 'Link')}
                        </button>
                      </div>
                    </div>

                    {/* Re-sync Button */}
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        border: '1px solid rgba(0, 102, 51, 0.25)',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: isPublishing ? 'wait' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        sync
                      </span>
                      {isPublishing
                        ? (isUrdu ? 'سنک ہو رہا ہے...' : 'Syncing changes...')
                        : (isUrdu ? 'تازہ ترین لسٹ دوبارہ سنک کریں' : 'Re-sync Updated Library')}
                    </button>

                    {shareFeedback && (
                      <div style={{ marginTop: '6px', fontSize: '0.68rem', color: '#059669', textAlign: 'center', fontWeight: 600 }}>
                        {shareFeedback}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Import Friend's Library Card */}
              <div
                className="quick-hub-card"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1.5px solid var(--glass-border)',
                  borderRadius: '14px',
                  padding: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
                    cloud_download
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {isUrdu ? 'دوست کی لائبریری حاصل کریں' : 'Import Friend\'s Library'}
                  </span>
                </div>

                <p style={{ margin: '0 0 10px 0', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {isUrdu
                    ? 'دوست کا شیئر کوڈ (مثلاً AP-7K9M) درج کریں تاکہ ان کی واچ لسٹ اور ہسٹری آپ کے پاس آ سکے۔'
                    : 'Enter friend\'s code (e.g. AP-7K9M) to load their watchlist and history.'}
                </p>

                {/* Input & Search Form */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoadFriendLibrary();
                    }}
                    placeholder="AP-XXXX"
                    maxLength={10}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 102, 51, 0.25)',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      background: 'rgba(0, 102, 51, 0.02)',
                    }}
                  />

                  {/* Paste button */}
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          const match = text.match(/share=([A-Za-z0-9\-]+)/i);
                          const clean = (match ? match[1] : text).trim().toUpperCase();
                          setFriendCodeInput(clean);
                          handleLoadFriendLibrary(clean);
                        }
                      } catch (e) {}
                    }}
                    title={isUrdu ? 'پیسٹ کریں' : 'Paste Code'}
                    type="button"
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(0, 102, 51, 0.07)',
                      border: '1px solid rgba(0, 102, 51, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      content_paste
                    </span>
                  </button>

                  <button
                    onClick={() => handleLoadFriendLibrary()}
                    disabled={isLoadingFriend || !friendCodeInput.trim()}
                    type="button"
                    style={{
                      padding: '8px 14px',
                      background: 'var(--color-primary)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (isLoadingFriend || !friendCodeInput.trim()) ? 'default' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: (isLoadingFriend || !friendCodeInput.trim()) ? 0.6 : 1,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                      {isLoadingFriend ? 'hourglass_top' : 'search'}
                    </span>
                    {isLoadingFriend ? (isUrdu ? 'تلاش...' : 'Loading...') : (isUrdu ? 'تلاش' : 'Fetch')}
                  </button>
                </div>

                {/* Error Message */}
                {friendFetchError && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      color: '#991b1b',
                      fontSize: '0.70rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                      info
                    </span>
                    {friendFetchError}
                  </div>
                )}

                {/* Friend Library Found Details */}
                {friendLibrary && (
                  <div
                    style={{
                      background: 'rgba(0, 102, 51, 0.04)',
                      border: '1px solid rgba(0, 102, 51, 0.2)',
                      borderRadius: '10px',
                      padding: '10px',
                      marginTop: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {isUrdu ? 'دوست کا ڈیٹا موصول ہو گیا' : 'Friend\'s Library Found'}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                        {friendLibrary.share_code}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <div style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                          {friendLibrary.watchlist.length}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          {isUrdu ? 'واچ لسٹ اینیمے' : 'Watchlist Anime'}
                        </div>
                      </div>

                      <div style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                          {friendLibrary.history.length}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          {isUrdu ? 'دیکھی گئی اقساط' : 'Watched Episodes'}
                        </div>
                      </div>
                    </div>

                    {/* Merge or Replace Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={() => handleApplyLibrary('merge')}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--color-primary)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(0, 102, 51, 0.25)',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                          library_add
                        </span>
                        {isUrdu ? 'اپنی لائبریری میں شامل کریں (Merge)' : 'Merge into My Library (Recommended)'}
                      </button>

                      <button
                        onClick={() => {
                          const confirmReplace = window.confirm(
                            isUrdu
                              ? 'کیا آپ واقعی اپنی موجودہ لائبریری کو تبدیل کرنا چاہتے ہیں؟'
                              : 'Are you sure you want to replace your current library with your friend\'s library?'
                          );
                          if (confirmReplace) handleApplyLibrary('replace');
                        }}
                        style={{
                          padding: '7px 10px',
                          background: 'transparent',
                          color: '#b91c1c',
                          border: '1px solid rgba(185, 28, 28, 0.3)',
                          borderRadius: '8px',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          swap_horiz
                        </span>
                        {isUrdu ? 'مکمل تبدیل کریں (Replace)' : 'Replace My Entire Library'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Import Success Note */}
                {importSuccess && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#dcfce7',
                      border: '1px solid #86efac',
                      color: '#15803d',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      check_circle
                    </span>
                    {importSuccess}
                  </div>
                )}
              </div>
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
        .quick-hub-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .quick-hub-scroll::-webkit-scrollbar-track {
          background: rgba(0, 102, 51, 0.04);
          border-radius: 4px;
        }
        .quick-hub-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 102, 51, 0.25);
          border-radius: 4px;
        }
        .quick-hub-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--color-primary);
        }
        @media (max-width: 600px) {
          :global(.quick-hub-popover) {
            position: fixed !important;
            top: calc(65px + var(--sat, 0px)) !important;
            left: 10px !important;
            right: 10px !important;
            bottom: auto !important;
            width: auto !important;
            max-width: calc(100vw - 20px) !important;
            max-height: calc(100dvh - 78px - var(--sab, 0px)) !important;
            z-index: 10000 !important;
            border-radius: 16px !important;
            padding: 10px 10px 4px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
