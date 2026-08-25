'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WatchProgressItem, getWatchHistory, removeWatchItem } from '@/lib/watchHistory';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';

export default function ContinueWatchingSection() {
  const { language } = useLanguage();
  const [items, setItems] = useState<WatchProgressItem[]>([]);

  useEffect(() => {
    setItems(getWatchHistory());

    const handleStorage = () => {
      setItems(getWatchHistory());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleRemove = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeWatchItem(slug);
    setItems(getWatchHistory());
  };

  if (items.length === 0) return null;

  return (
    <section 
      aria-label="Continue Watching"
      style={{
        marginBottom: '32px',
        position: 'relative',
      }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '4px',
            height: '18px',
            borderRadius: '2px',
            background: 'var(--color-primary)',
          }} />
          <h2 style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}>
            {language === 'ur' ? 'دیکھنا جاری رکھیں' : 'Continue Watching'}
          </h2>
        </div>

        <span className="glass-badge" style={{ fontSize: '0.72rem' }}>
          {items.length} {language === 'ur' ? 'جاری' : 'in progress'}
        </span>
      </div>

      {/* Horizontal Scroll Cards Row */}
      <div 
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => {
          const watchLink = item.type === 'movie'
            ? `/watch/${item.animeSlug}`
            : `/watch/${item.animeSlug}/${item.epSlug || ''}`;

          const imageSrc = getProxiedImageUrl(item.backdrop || item.poster, 'backdrop');

          return (
            <div 
              key={item.animeSlug}
              className="glass-card continue-card"
              style={{
                flexShrink: 0,
                width: '230px',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                background: 'rgba(8, 22, 14, 0.85)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(0, 230, 118, 0.18)',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              <Link href={watchLink} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                {/* Widescreen Preview with Progress Bar */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '130px',
                  background: '#041208',
                  overflow: 'hidden',
                }}>
                  {imageSrc && (
                    <img 
                      src={imageSrc} 
                      alt={item.animeTitle}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  {/* Gradient Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
                  }} />

                  {/* Play Button Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(0, 102, 51, 0.85)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>play_arrow</span>
                  </div>

                  {/* Percentage Progress Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(4px)',
                    color: '#00ff66',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 255, 102, 0.3)',
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
                      width: '24px',
                      height: '24px',
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
                    title="Remove from history"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>

                  {/* Bottom Linear Progress Line */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    zIndex: 2,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${item.progressPercent}%`,
                      background: 'linear-gradient(90deg, #00ff66 0%, #10b981 100%)',
                      boxShadow: '0 0 8px rgba(0, 255, 102, 0.8)',
                    }} />
                  </div>
                </div>

                {/* Details Footer */}
                <div style={{
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  <h3 style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.animeTitle}
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: 'rgba(255, 255, 255, 0.65)',
                    fontWeight: 600,
                  }}>
                    <span>{item.type === 'movie' ? 'Movie' : (item.epTitle || `Episode ${item.epNumber || 1}`)}</span>
                    <span style={{ color: '#00ff88', fontWeight: 800 }}>
                      {language === 'ur' ? 'جاری رکھیں' : 'Resume'} →
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
