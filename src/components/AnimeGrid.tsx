'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { AnimeItem } from '@/types/anime';
import AnimeCard from './AnimeCard';
import { useLanguage } from '@/context/LanguageContext';

interface AnimeGridProps {
  initialItems: AnimeItem[];
  initialType?: string;
}

function AnimeGridContent({ initialItems, initialType }: AnimeGridProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { t } = useLanguage();

  const urlType = searchParams?.get('type') || initialType || 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>(urlType);
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');

  // Keep selectedType in sync with URL searchParams
  useEffect(() => {
    const currentParam = searchParams?.get('type') || initialType || 'all';
    setSelectedType(currentParam);
  }, [searchParams, initialType]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (type === 'all') {
          params.delete('type');
        } else {
          params.set('type', type);
        }
        const query = params.toString();
        const targetPath = pathname || window.location.pathname || '/browse';
        const targetUrl = `${targetPath}${query ? `?${query}` : ''}`;
        window.history.replaceState(null, '', targetUrl);
      } catch (e) {}
    }
  };

  // Available alphabets
  const alphabets = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  // Extract all unique languages
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    initialItems.forEach(item => {
      item.audioLanguages?.forEach(l => langs.add(l));
    });
    return ['ALL', ...Array.from(langs).sort()];
  }, [initialItems]);

  // Filtered anime list
  const filteredItems = useMemo(() => {
    return initialItems.filter(item => {
      // 1. Filter by Type
      if (selectedType === 'movies' && item.type !== 'movie') return false;
      if (selectedType === 'series' && item.type !== 'series') return false;

      // 2. Filter by Language
      if (selectedLanguage !== 'ALL') {
        if (!item.audioLanguages?.includes(selectedLanguage)) return false;
      }

      // 3. Filter by Alphabet
      const title = item.anilist?.englishName || item.anilist?.romajiName || item.title;
      if (selectedLetter !== 'ALL') {
        const firstChar = title.trim()[0]?.toUpperCase();
        if (selectedLetter === '#') {
          if (firstChar >= 'A' && firstChar <= 'Z') return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchEn = item.anilist?.englishName?.toLowerCase().includes(query);
        const matchRomaji = item.anilist?.romajiName?.toLowerCase().includes(query);
        const matchGenre = item.genres?.some(g => g.toLowerCase().includes(query)) ||
                           item.anilist?.genres?.some(g => g.toLowerCase().includes(query));
        if (!matchTitle && !matchEn && !matchRomaji && !matchGenre) return false;
      }

      return true;
    });
  }, [initialItems, selectedType, selectedLanguage, selectedLetter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and Filters Bar */}
      <div className="glass-panel" style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {/* Top Filter Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            flexGrow: 1,
            minWidth: '220px',
          }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-primary)',
              pointerEvents: 'none',
              fontSize: '20px',
            }}>
              search
            </span>
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
              style={{
                paddingLeft: '40px',
                paddingRight: searchQuery ? '36px' : '16px',
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
          </div>

          {/* Type Switcher Pills */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 102, 51, 0.08)',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px',
          }}>
            <button
              onClick={() => handleTypeChange('all')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedType === 'all' ? 'var(--color-primary)' : 'transparent',
                color: selectedType === 'all' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedType === 'all' ? 700 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t('filterAll')}
            </button>
            <button
              onClick={() => handleTypeChange('series')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedType === 'series' ? 'var(--color-primary)' : 'transparent',
                color: selectedType === 'series' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedType === 'series' ? 700 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t('filterSeries')}
            </button>
            <button
              onClick={() => handleTypeChange('movies')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: selectedType === 'movies' ? 'var(--color-primary)' : 'transparent',
                color: selectedType === 'movies' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedType === 'movies' ? 700 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t('filterMovies')}
            </button>
          </div>
        </div>

        {/* Alphabet Filter Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginRight: '6px',
            flexShrink: 0,
          }}>
            {t('filterAtoZ')}:
          </span>
          {alphabets.map(letter => (
            <button
              key={letter}
              onClick={() => setSelectedLetter(letter)}
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: '6px',
                border: selectedLetter === letter ? '1.5px solid var(--color-primary)' : '1px solid transparent',
                background: selectedLetter === letter ? 'var(--color-primary)' : 'rgba(0, 102, 51, 0.05)',
                color: selectedLetter === letter ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedLetter === letter ? 800 : 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Audio Language Filter Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginRight: '6px',
            flexShrink: 0,
          }}>
            {t('filterLanguage')}:
          </span>
          {availableLanguages.map(lang => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: selectedLanguage === lang ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                background: selectedLanguage === lang ? 'var(--color-primary)' : '#ffffff',
                color: selectedLanguage === lang ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedLanguage === lang ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Results Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 4px',
      }}>
        <h2 style={{
          fontSize: '1.15rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}>
          {selectedType === 'movies' ? t('popularMovies') : selectedType === 'series' ? t('trendingSeries') : t('allAnimeCatalog')}
        </h2>
        <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>
          {filteredItems.length} {t('catalogResultsCount')}
        </span>
      </div>

      {/* Anime Cards Grid */}
      {filteredItems.length > 0 ? (
        <div 
          className="anime-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '14px',
          }}
        >
          {filteredItems.map(item => (
            <AnimeCard key={item.slug} item={item} />
          ))}
        </div>
      ) : (
        <div className="glass-panel" style={{
          padding: '60px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '12px' }}>
            search_off
          </span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('noResultsTitle')}</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '6px', color: 'var(--text-muted)' }}>
            {t('noResultsDesc')}
          </p>
          <button 
            onClick={() => {
              setSearchQuery('');
              handleTypeChange('all');
              setSelectedLanguage('ALL');
              setSelectedLetter('ALL');
            }}
            className="glass-btn"
            style={{ marginTop: '16px', fontSize: '0.85rem', padding: '8px 16px' }}
          >
            {t('resetFilters')}
          </button>
        </div>
      )}

      {/* Grid Breakpoint Tuning */}
      <style jsx>{`
        @media (min-width: 640px) {
          .anime-cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
            gap: 20px !important;
          }
        }
        @media (min-width: 1024px) {
          .anime-cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(195px, 1fr)) !important;
            gap: 22px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function AnimeGrid(props: AnimeGridProps) {
  return (
    <Suspense fallback={null}>
      <AnimeGridContent {...props} />
    </Suspense>
  );
}
