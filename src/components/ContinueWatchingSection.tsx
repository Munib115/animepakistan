'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WatchProgressItem, getWatchHistory, removeWatchItem } from '@/lib/watchHistory';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { sound } from '@/lib/soundEngine';

export default function ContinueWatchingSection() {
  const { language } = useLanguage();
  const [items, setItems] = useState<WatchProgressItem[]>([]);

  useEffect(() => {
    setItems(getWatchHistory());

    const handleUpdate = () => {
      setItems(getWatchHistory());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('ap_history_updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('ap_history_updated', handleUpdate);
    };
  }, []);

  const handleRemove = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    sound.pop();
    removeWatchItem(slug);
    setItems(getWatchHistory());
  };

  if (items.length === 0) return null;

  return (
    <section 
      aria-label="Continue Watching"
      style={{
        marginBottom: '24px',
        position: 'relative',
      }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '4px',
            height: '16px',
            borderRadius: '999px',
            background: 'var(--color-primary)',
          }} />
          <h2 style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            {language === 'ur' ? 'دیکھنا جاری رکھیں' : 'Continue Watching'}
          </h2>
        </div>

        <span className="glass-badge" style={{ fontSize: '0.70rem', padding: '2px 8px' }}>
          {items.length} {language === 'ur' ? 'جاری' : 'in progress'}
        </span>
      </div>

      {/* Horizontal Scroll Cards Row — Compact, Professional, No Empty Blank Space */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '6px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => {
          const watchLink = item.type === 'movie'
            ? `/watch/${item.animeSlug}`
            : `/watch/${item.animeSlug}/${item.epSlug || ''}`;

          const imageSrc = getProxiedImageUrl(item.backdrop || item.poster, 'backdrop');
          const cleanEpLabel = item.type === 'movie'
            ? (language === 'ur' ? 'مکمل مووی' : 'Movie')
            : `Ep ${item.epNumber || (item.epTitle?.match(/(\d+)/)?.[1] || 1)}`;

          return (
            <div 
              key={item.animeSlug}
              className="glass-card"
              style={{
                flexShrink: 0,
                width: '190px',
                borderRadius: '18px',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--glass-shadow)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              <Link 
                href={watchLink}
                prefetch={false}
                onClick={() => sound.playCardClick()}
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', color: 'inherit' }}
              >
                {/* 16:9 Widescreen Preview (190px width -> 106px height) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '106px',
                  background: 'var(--bg-tertiary)',
                  overflow: 'hidden',
                }}>
                  {imageSrc ? (
                    <img 
                      src={imageSrc} 
                      alt={item.animeTitle}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.2) 0%, rgba(0, 50, 25, 0.4) 100%)',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-primary)', opacity: 0.6 }}>
                        smart_display
                      </span>
                    </div>
                  )}

                  {/* Subtle Gradient Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)',
                  }} />

                  {/* Sleek Play Button Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(0, 102, 51, 0.85)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255,255,255,0.25)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
                  </div>

                  {/* Percentage Progress Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    background: 'rgba(0, 0, 0, 0.80)',
                    backdropFilter: 'blur(4px)',
                    color: '#00ff88',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(0, 255, 102, 0.3)',
                    lineHeight: 1.2,
                  }}>
                    {item.progressPercent}%
                  </div>

                  {/* Top Delete X Button */}
                  <button
                    onClick={(e) => handleRemove(e, item.animeSlug)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(4px)',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 3,
                    }}
                    title={language === 'ur' ? 'ہسٹری سے ہٹائیں' : 'Remove from history'}
                    aria-label="Remove"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>

                  {/* Bottom Linear Progress Line */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    zIndex: 2,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${item.progressPercent}%`,
                      background: 'linear-gradient(90deg, #00ff66 0%, #10b981 100%)',
                      boxShadow: '0 0 6px rgba(0, 255, 102, 0.8)',
                    }} />
                  </div>
                </div>

                {/* Compact Details Footer — Zero Extra Blank Area */}
                <div style={{
                  padding: '7px 9px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}>
                  <h3 style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    margin: 0,
                    lineHeight: 1.3,
                  }}>
                    {item.animeTitle}
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '105px' }}>
                      {cleanEpLabel}
                    </span>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 800, flexShrink: 0 }}>
                      {language === 'ur' ? 'چلائیں' : 'Resume'} →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
