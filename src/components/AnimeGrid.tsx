'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { AnimeItem } from '@/types/anime';
import AnimeCard from './AnimeCard';
import { useLanguage } from '@/context/LanguageContext';
import { sound } from '@/lib/soundEngine';

interface AnimeGridProps {
  initialItems: AnimeItem[];
  initialType?: string;
}

function AnimeGridContent({ initialItems, initialType }: AnimeGridProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { t, language } = useLanguage();

  const urlType = searchParams?.get('type') || initialType || 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    sound.playButton();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice search is not supported on this browser. Please use Chrome/Android Chrome.");
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
        setSearchQuery(cleaned);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

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
        const normalizedQuery = query.replace(/\bbenten\b/gi, 'ben 10').replace(/\bben\s+ten\b/gi, 'ben 10');
        const matchTitle = item.title.toLowerCase().includes(query) || item.title.toLowerCase().includes(normalizedQuery);
        const matchEn = item.anilist?.englishName?.toLowerCase().includes(query) || item.anilist?.englishName?.toLowerCase().includes(normalizedQuery);
        const matchRomaji = item.anilist?.romajiName?.toLowerCase().includes(query) || item.anilist?.romajiName?.toLowerCase().includes(normalizedQuery);
        const matchGenre = item.genres?.some(g => g.toLowerCase().includes(query) || g.toLowerCase().includes(normalizedQuery)) ||
                           item.anilist?.genres?.some(g => g.toLowerCase().includes(query) || g.toLowerCase().includes(normalizedQuery));
        if (!matchTitle && !matchEn && !matchRomaji && !matchGenre) return false;
      }

      return true;
    });
  }, [initialItems, selectedType, selectedLanguage, selectedLetter, searchQuery]);

  const [displayCount, setDisplayCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset display count on filter change
  useEffect(() => {
    setDisplayCount(24);
  }, [selectedType, selectedLanguage, selectedLetter, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayCount((prev) => prev + 24);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredItems.length]);

  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and Filters Curvy Glass Card */}
      <div 
        className="glass-panel" 
        style={{
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderRadius: '24px',
          border: '1.5px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
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
              left: '14px',
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
              placeholder={isListening ? (language === 'ur' ? "سن رہا ہے... بولیں" : "Listening... Speak now") : t('searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
              style={{
                width: '100%',
                padding: '11px 72px 11px 42px',
                borderRadius: '999px',
                border: '1.5px solid var(--glass-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.90rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {/* Mic Icon Button */}
              <button 
                type="button" 
                onClick={startVoiceSearch} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: isListening ? '#ef4444' : 'var(--color-primary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: isListening ? 'pulse-mic 1.5s infinite' : 'none',
                }}
                title="Voice Search"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {isListening ? 'mic' : 'mic_none'}
                </span>
              </button>

              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              )}
            </div>
          </div>

          {/* Type Switcher Curvy Pills */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 102, 51, 0.08)',
            padding: '4px',
            borderRadius: '999px',
            gap: '4px',
            border: '1px solid var(--glass-border)',
          }}>
            {[
              { id: 'all', label: t('filterAll') },
              { id: 'series', label: t('filterSeries') },
              { id: 'movies', label: t('filterMovies') },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => {
                  sound.playTabSwitch();
                  handleTypeChange(type.id);
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  background: selectedType === type.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedType === type.id ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: selectedType === type.id ? 800 : 600,
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedType === type.id ? '0 2px 8px rgba(0, 102, 51, 0.25)' : 'none',
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alphabet Filter Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: 'var(--text-muted)',
            marginRight: '4px',
            flexShrink: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {t('filterAtoZ')}:
          </span>
          {alphabets.map(letter => (
            <button
              key={letter}
              onClick={() => {
                sound.pop();
                setSelectedLetter(letter);
              }}
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: '999px',
                border: selectedLetter === letter ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                background: selectedLetter === letter ? 'var(--color-primary)' : 'var(--bg-secondary)',
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
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: 'var(--text-muted)',
            marginRight: '4px',
            flexShrink: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {t('filterLanguage')}:
          </span>
          {availableLanguages.map(lang => (
            <button
              key={lang}
              onClick={() => {
                sound.pop();
                setSelectedLanguage(lang);
              }}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: selectedLanguage === lang ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                background: selectedLanguage === lang ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: selectedLanguage === lang ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: selectedLanguage === lang ? 800 : 600,
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

      {/* Grid Results Header with Zero Collision */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        padding: '0 4px',
        margin: '6px 0 2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '4px',
            height: '18px',
            borderRadius: '999px',
            background: 'var(--color-primary)',
            flexShrink: 0,
          }} />
          <h2 style={{
            fontSize: 'clamp(1.05rem, 3.2vw, 1.3rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedType === 'movies' ? t('catalogHeadingMovies') : selectedType === 'series' ? t('catalogHeadingSeries') : t('allAnimeCatalog')}
          </h2>
        </div>

        {/* Count Pill Badge - Curvy, Clean, No Text Collision */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 12px',
          borderRadius: '999px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.80rem',
            fontWeight: 800,
            color: 'var(--color-primary)',
          }}>
            {visibleItems.length}
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>/</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {filteredItems.length} {t('catalogResultsCount')}
          </span>
        </div>
      </div>

      {/* Anime Cards Grid */}
      {filteredItems.length > 0 ? (
        <>
          <div 
            className="anime-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '14px',
              alignItems: 'stretch',
            }}
          >
            {visibleItems.map(item => (
              <AnimeCard key={item.slug} item={item} />
            ))}
          </div>

          {/* Sentinel for progressive infinite loading */}
          {displayCount < filteredItems.length && (
            <div 
              ref={loadMoreRef} 
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '24px 0',
              }}
            >
              <button
                onClick={() => setDisplayCount((prev) => prev + 24)}
                className="glass-btn-secondary"
                style={{ padding: '9px 24px', fontSize: '0.82rem', borderRadius: '999px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
                <span>{language === 'ur' ? 'مزید لوڈ کریں' : 'Load More Anime'}</span>
              </button>
            </div>
          )}
        </>
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

      {/* Grid Breakpoint Tuning for Mobile & PC */}
      <style jsx>{`
        @keyframes pulse-mic {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 480px) {
          .anime-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
        }
        @media (min-width: 481px) and (max-width: 767px) {
          .anime-cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important;
            gap: 14px !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .anime-cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;
            gap: 18px !important;
          }
        }
        @media (min-width: 1024px) {
          .anime-cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)) !important;
            gap: 20px !important;
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
