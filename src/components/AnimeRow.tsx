'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { AnimeItem } from '@/types/anime';
import AnimeCard from './AnimeCard';
import { useLanguage } from '@/context/LanguageContext';

interface AnimeRowProps {
  title: string;
  items: AnimeItem[];
  browseHref?: string;
}

export default function AnimeRow({ title, items, browseHref = '/browse' }: AnimeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();

  const scroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const distance = 400;
    rowRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  if (items.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      marginBottom: '36px',
    }}>
      {/* Row Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
            {title}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View All Link */}
          <Link 
            href={browseHref}
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>{t('viewAll')}</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {language === 'ur' ? 'chevron_left' : 'chevron_right'}
            </span>
          </Link>

          {/* Desktop Arrow Controls */}
          <div style={{
            display: 'none',
            alignItems: 'center',
            gap: '6px',
          }} className="row-arrows">
            <button
              onClick={() => scroll('left')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              aria-label="Scroll Left"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                chevron_left
              </span>
            </button>
            <button
              onClick={() => scroll('right')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              aria-label="Scroll Right"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div 
        ref={rowRef}
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '8px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item, idx) => (
          <div 
            key={`${item.slug}-${idx}`}
            className="row-card-item"
            style={{
              scrollSnapAlign: 'start',
              flexShrink: 0,
            }}
          >
            <AnimeCard item={item} />
          </div>
        ))}
      </div>

      <style jsx>{`
        .row-card-item {
          width: 138px;
          min-width: 138px;
        }
        @media (min-width: 480px) {
          .row-card-item {
            width: 155px;
            min-width: 155px;
          }
        }
        @media (min-width: 768px) {
          .row-card-item {
            width: 175px !important;
            min-width: 175px !important;
          }
          .row-arrows {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
