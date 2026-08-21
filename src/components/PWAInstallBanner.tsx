'use client';

import React, { useState, useEffect } from 'react';
import { sound } from '@/lib/soundEngine';
import { useLanguage } from '@/context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallBanner() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Check if dismissed previously in the last 7 days
    const dismissedTime = localStorage.getItem('ap_pwa_banner_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    // Listen for Chrome / Android / Desktop PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS Safari or when prompt is not immediately fired, show banner after 2.5s on first visit
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setShowBanner(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    sound.playButton();

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosModal(true);
    } else {
      // General instructions fallback
      alert('To install Anime Pakistan, tap your browser menu (⋮) and choose "Install App" or "Add to Home Screen".');
    }
  };

  const handleDismiss = () => {
    sound.playButton();
    setShowBanner(false);
    try {
      localStorage.setItem('ap_pwa_banner_dismissed', Date.now().toString());
    } catch (e) {}
  };

  if (!showBanner) return null;

  const isUrdu = language === 'ur';

  return (
    <>
      {/* Liquid Glass Bottom Download App Banner */}
      <div 
        className="pwa-install-banner"
        style={{
          position: 'fixed',
          bottom: 'calc(76px + var(--sab, 0px))',
          left: '14px',
          right: '14px',
          maxWidth: '520px',
          margin: '0 auto',
          zIndex: 99998,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: '1.5px solid rgba(0, 102, 51, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 20px 48px -8px rgba(0, 70, 35, 0.28), 0 8px 18px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 1)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          animation: 'bannerSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          direction: isUrdu ? 'rtl' : 'ltr',
        }}
      >
        {/* Left: App Logo & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexGrow: 1 }}>
          {/* 3D App Icon */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(0, 102, 51, 0.35)',
            background: '#02140a',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img 
              src="/logo.png?v=ap2" 
              alt="Anime Pakistan Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>

          {/* Title and Rating */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                fontSize: '0.88rem',
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isUrdu ? 'اینیمے پاکستان ایپ' : 'Anime Pakistan App'}
              </span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                padding: '1px 5px',
                borderRadius: '4px',
                background: '#02180d',
                color: '#00ff66',
                border: '1px solid rgba(0, 204, 102, 0.4)',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}>
                AP
              </span>
            </div>

            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {isUrdu ? '★ 4.9 · تیز ترین فل ایچ ڈی اسٹریمنگ' : '★ 4.9 · Fast 1080p Ad-Free App'}
            </span>
          </div>
        </div>

        {/* Right: Install Action & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleInstallClick}
            className="glass-btn"
            style={{
              padding: '8px 14px',
              fontSize: '0.78rem',
              fontWeight: 900,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 4px 14px rgba(0, 102, 51, 0.3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
            <span>{isUrdu ? 'ایپ انسٹال کریں' : 'Install App'}</span>
          </button>

          {/* Dismiss ✕ Button */}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0, 102, 51, 0.07)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title="Dismiss"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
          </button>
        </div>
      </div>

      {/* iOS Install Helper Modal */}
      {showIosModal && (
        <div 
          onClick={() => setShowIosModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '24px 20px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              textAlign: 'center',
              animation: 'modalSlideUp 0.3s ease-out',
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              margin: '0 auto 12px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 102, 51, 0.3)',
              background: '#02140a',
            }}>
              <img src="/logo.png?v=ap2" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Install on iPhone / iPad
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              1. Tap the <strong>Share</strong> button <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>ios_share</span> in Safari.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong> <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>add_box</span>.
            </p>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="glass-btn"
              style={{ width: '100%', padding: '12px', fontWeight: 800 }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes bannerSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (min-width: 768px) {
          .pwa-install-banner {
            bottom: 24px !important;
            right: 24px !important;
            left: auto !important;
            width: 440px;
          }
        }
      `}</style>
    </>
  );
}
