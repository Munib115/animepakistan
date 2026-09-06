'use client';

import React, { useState, useEffect } from 'react';
import { sound } from '@/lib/soundEngine';
import { useLanguage } from '@/context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    _pwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export default function PWAInstallBanner() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [platformType, setPlatformType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Check platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatformType('ios');
    } else if (/android/.test(userAgent)) {
      setPlatformType('android');
    } else {
      setPlatformType('desktop');
    }

    // Check if globally captured or attach listener
    if (window._pwaPrompt) {
      setDeferredPrompt(window._pwaPrompt);
      setShowBanner(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window._pwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show banner after 1.8s
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setShowBanner(true);
      }
    }, 1800);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    sound.playButton();

    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window._pwaPrompt : null);

    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setShowBanner(false);
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') window._pwaPrompt = null;
        }
      } catch (err) {
        setShowGuideModal(true);
      }
    } else {
      // Open device-specific visual install guide modal
      setShowGuideModal(true);
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
      {/* Liquid Glass Modern PWA App Banner with High Transparency & White Border */}
      <div 
        className="pwa-install-banner"
        style={{
          position: 'fixed',
          bottom: 'calc(88px + var(--sab, 0px))',
          left: '16px',
          right: '16px',
          maxWidth: '440px',
          margin: '0 auto',
          zIndex: 99998,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(0, 40, 20, 0.35) 50%, rgba(255, 255, 255, 0.12) 100%)',
          backdropFilter: 'blur(32px) saturate(220%) brightness(108%)',
          WebkitBackdropFilter: 'blur(32px) saturate(220%) brightness(108%)',
          border: '1.5px solid rgba(255, 255, 255, 0.85)',
          borderRadius: '20px',
          boxShadow: '0 20px 48px -6px rgba(0, 0, 0, 0.45), inset 0 1.5px 2px rgba(255, 255, 255, 0.95), inset 0 -1px 2px rgba(255, 255, 255, 0.25), 0 0 25px rgba(255, 255, 255, 0.18)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          animation: 'bannerSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          direction: isUrdu ? 'rtl' : 'ltr',
        }}
      >
        {/* Left: App Logo & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexGrow: 1 }}>
          {/* 3D App Icon with Liquid Glass Ring */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
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
                fontSize: '0.82rem',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.85)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isUrdu ? 'اینیمے پاکستان ایپ' : 'Anime Pakistan App'}
              </span>
              <span style={{
                fontSize: '0.58rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(0, 255, 102, 0.25)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 0 8px rgba(0, 255, 102, 0.4)',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}>
                AP
              </span>
            </div>

            <span style={{
              fontSize: '0.66rem',
              color: '#ffffff',
              opacity: 0.92,
              fontWeight: 700,
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
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
            style={{
              padding: '7px 16px',
              fontSize: '0.74rem',
              fontWeight: 900,
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'linear-gradient(135deg, #00c853 0%, #007e33 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.9)',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(0, 200, 83, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
            <span>{isUrdu ? 'انسٹال' : 'Install'}</span>
          </button>

          {/* Dismiss ✕ Button with Liquid Glass */}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              transition: 'background 0.2s',
            }}
            title="Dismiss"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
          </button>
        </div>
      </div>

      {/* Universal Step-by-Step Install Guide Modal */}
      {showGuideModal && (
        <div 
          onClick={() => setShowGuideModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1.5px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '24px 20px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              textAlign: 'center',
              animation: 'modalSlideUp 0.3s ease-out',
              direction: isUrdu ? 'rtl' : 'ltr',
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
              {isUrdu ? 'اینیمے پاکستان ایپ انسٹال کریں' : 'Install Anime Pakistan App'}
            </h3>

            {platformType === 'ios' ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px', textAlign: isUrdu ? 'right' : 'left' }}>
                <p>1. سفاری براؤزر کے نیچے <strong>Share</strong> بٹن <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>ios_share</span> دبائیں۔</p>
                <p>2. فہرست میں نیچے سکرول کر کے <strong>Add to Home Screen</strong> <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>add_box</span> منتخب کریں۔</p>
              </div>
            ) : platformType === 'android' ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px', textAlign: isUrdu ? 'right' : 'left' }}>
                <p>1. کروم براؤزر کے اوپر دائیں کونے میں تین نقطوں (<strong>⋮</strong>) پر ٹیپ کریں۔</p>
                <p>2. مینو میں سے <strong>Install App</strong> یا <strong>Add to Home Screen</strong> پر کلک کریں۔</p>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px', textAlign: isUrdu ? 'right' : 'left' }}>
                <p>1. اپنے براؤزر کے ایڈریس بار میں موجود <strong>Install App (⊕)</strong> آئیکون پر کلک کریں۔</p>
                <p>2. یا براؤزر مینو (⋮) کھول کر <strong>Install Anime Pakistan</strong> منتخب کریں۔</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="glass-btn"
              style={{ width: '100%', padding: '12px', fontWeight: 800 }}
            >
              {isUrdu ? 'سمجھ گیا (Done)' : 'Got it'}
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
