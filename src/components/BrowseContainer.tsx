'use client';

import React from 'react';
import { AnimeItem } from '@/types/anime';
import AnimeGrid from './AnimeGrid';
import { useLanguage } from '@/context/LanguageContext';

interface BrowseContainerProps {
  initialItems: AnimeItem[];
  initialType?: string;
}

export default function BrowseContainer({ initialItems, initialType }: BrowseContainerProps) {
  const { t } = useLanguage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Title & Subtitle */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 3.5vw, 1.85rem)',
          fontWeight: 900,
          color: 'var(--text-primary)',
        }}>
          {t('browsePageTitle')}
        </h1>
        <p style={{
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {t('browsePageDesc')}
        </p>
      </div>

      {/* Full Filtering and Search Grid */}
      <AnimeGrid initialItems={initialItems} initialType={initialType} />
    </div>
  );
}
