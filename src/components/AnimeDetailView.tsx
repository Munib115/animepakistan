'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AnimeItem, Episode } from '@/types/anime';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { sound } from '@/lib/soundEngine';

interface AnimeDetailViewProps {
  anime: AnimeItem;
}

export default function AnimeDetailView({ anime }: AnimeDetailViewProps) {
  const { t, language } = useLanguage();
  const [selectedSeason, setSelectedSeason] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = language === 'en'
    ? (anime.anilist?.englishName || anime.title)
    : (anime.anilist?.romajiName || anime.anilist?.englishName || anime.title);

  const nativeName = anime.anilist?.nativeName || '';
  const description = anime.anilist?.description
    ? anime.anilist.description.replace(/<[^>]*>?/gm, '')
    : anime.description || t('detailsComingSoon');

  const rawCover = anime.poster || anime.anilist?.coverImage || '';
  const rawBanner = anime.anilist?.bannerImage || anime.backdrop || '';
  
  const coverUrl = getProxiedImageUrl(rawCover);
  const bannerUrl = getProxiedImageUrl(rawBanner);
  
  const rating = anime.anilist?.rating ? (anime.anilist.rating / 10).toFixed(1) : null;
  const isMovie = anime.type === 'movie';

  // Discover all seasons present in episodes
  const availableSeasons = useMemo(() => {
    const set = new Set<number>();
    anime.episodes?.forEach((ep) => {
      if (ep.season) {
        set.add(ep.season);
      } else {
        const match = ep.title.match(/^S(\d+)/i) || ep.slug.match(/(\d+)x\d+/i);
        if (match) set.add(parseInt(match[1], 10));
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [anime.episodes]);

  // Filter episodes by season and search query
  const filteredEpisodes = useMemo(() => {
    if (!anime.episodes) return [];
    return anime.episodes.filter((ep) => {
      // 1. Season filter
      if (selectedSeason !== 'ALL') {
        const epSeason = ep.season || (ep.title.match(/^S(\d+)/i) ? parseInt(ep.title.match(/^S(\d+)/i)![1], 10) : 1);
        if (epSeason !== selectedSeason) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return ep.title.toLowerCase().includes(q) || ep.slug.toLowerCase().includes(q) || String(ep.number).includes(q);
      }

      return true;
    });
  }, [anime.episodes, selectedSeason, searchQuery]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Background Banner */}
      {bannerUrl && (
        <div style={{
          position: 'absolute',
          top: -24,
          left: -16,
          right: -16,
          height: '380px',
          backgroundImage: `url(${bannerUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 25%',
          opacity: 0.18,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 0,
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Back Link */}
        <div style={{ marginBottom: '16px' }}>
          <Link href="/browse" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-primary)',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {language === 'ur' ? 'arrow_forward' : 'arrow_back'}
            </span>
            <span>{t('backToCatalog')}</span>
          </Link>
        </div>

        {/* Top Details Card */}
        <div className="glass-panel" style={{ padding: '24px 20px', marginBottom: '24px' }}>
          <div className="detail-top-layout">
            
            {/* Poster Column */}
            <div style={{
              width: '100%',
              maxWidth: '220px',
              margin: '0 auto',
              flexShrink: 0,
            }}>
              <div style={{
                width: '100%',
                paddingTop: '142%',
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0, 102, 51, 0.18)',
                border: '2px solid var(--glass-border)',
                background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
              }}>
                {coverUrl ? (
                  <img 
                    src={coverUrl} 
                    alt={displayName} 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    textAlign: 'center',
                    color: '#ffffff',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '8px' }}>
                      {isMovie ? 'movie' : 'live_tv'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {displayName}
                    </span>
                  </div>
                )}
              </div>

              {/* Direct Play CTA for Movies */}
              {isMovie && (
                <Link 
                  href={`/watch/${anime.slug}`}
                  className="glass-btn"
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    fontSize: '0.95rem'
                  }}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  <span>{t('playMovie')}</span>
                </Link>
              )}
            </div>

            {/* Info Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
              
              {/* Badges Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span className="glass-badge" style={{
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                }}>
                  {isMovie ? t('movieBadge') : t('seriesBadge')}
                </span>

                {anime.anilist?.year && (
                  <span className="glass-badge-white">
                    {anime.anilist.year}
                  </span>
                )}

                {anime.anilist?.status && (
                  <span className="glass-badge-white">
                    {anime.anilist.status}
                  </span>
                )}

                {rating && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#ffffff',
                    border: '1px solid var(--glass-border)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#b45309'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#f59e0b' }}>star</span>
                    <span>{rating} / 10</span>
                  </span>
                )}
              </div>

              {/* Titles */}
              <div>
                <h1 style={{
                  fontSize: 'clamp(1.3rem, 3.5vw, 1.85rem)',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1.25,
                }}>
                  {displayName}
                </h1>
                {nativeName && nativeName !== displayName && (
                  <h2 style={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}>
                    {nativeName}
                  </h2>
                )}
              </div>

              {/* Genres */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(anime.anilist?.genres || anime.genres || []).map((genre) => (
                  <span key={genre} style={{
                    background: 'rgba(0, 102, 51, 0.08)',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 102, 51, 0.15)'
                  }}>
                    {genre}
                  </span>
                ))}
              </div>

              {/* Audio Languages */}
              {anime.audioLanguages && anime.audioLanguages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {t('availableAudio')}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {anime.audioLanguages.map((lang) => (
                      <span key={lang} style={{
                        background: '#ffffff',
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div style={{
                background: '#ffffff',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                marginTop: '4px',
              }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '6px' }}>
                  {t('overview')}
                </h3>
                <p style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}>
                  {description}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Series Episodes List with Season Filter Tabs */}
        {!isMovie && (
          <div className="glass-panel" style={{ padding: '24px 20px' }}>
            
            {/* Header with Season Controls */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginBottom: '20px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <h2 style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>playlist_play</span>
                  <span>{t('episodesList')}</span>
                </h2>
                
                <span className="glass-badge">
                  {filteredEpisodes.length} / {anime.episodes?.length || 0} {t('episodesSuffix')}
                </span>
              </div>

              {/* Season Selection Pills (If multiple seasons exist) */}
              {availableSeasons.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  scrollbarWidth: 'none',
                }}>
                  <button
                    onClick={() => {
                      setSelectedSeason('ALL');
                      sound.playTabSwitch();
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: selectedSeason === 'ALL' ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                      background: selectedSeason === 'ALL' ? 'var(--color-primary)' : '#ffffff',
                      color: selectedSeason === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: selectedSeason === 'ALL' ? 800 : 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    تمام سیزنز (All Seasons)
                  </button>

                  {availableSeasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSeason(s);
                        sound.playTabSwitch();
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: selectedSeason === s ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                        background: selectedSeason === s ? 'var(--color-primary)' : '#ffffff',
                        color: selectedSeason === s ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: selectedSeason === s ? 800 : 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                      }}
                    >
                      سیزن {s} (Season {s})
                    </button>
                  ))}
                </div>
              )}

              {/* Episode Search Box for fast lookup in big seasons */}
              {(anime.episodes?.length || 0) > 12 && (
                <div style={{ position: 'relative', maxWidth: '320px' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '18px',
                    color: 'var(--text-muted)',
                  }}>
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search episode title or number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-input"
                    style={{
                      padding: '8px 12px 8px 34px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              )}
            </div>

            {filteredEpisodes.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '12px',
              }}>
                {filteredEpisodes.map((ep) => {
                  const epThumb = getProxiedImageUrl(ep.thumbnail) || bannerUrl || coverUrl;
                  return (
                    <Link 
                      key={ep.slug} 
                      href={`/watch/${anime.slug}/${ep.slug}`}
                      prefetch={true}
                      onClick={() => sound.playEpisodeSelect()}
                      className="glass-card ep-item-card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px',
                        textDecoration: 'none',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{
                        width: '80px',
                        height: '50px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        position: 'relative',
                        background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
                        flexShrink: 0,
                      }}>
                        {epThumb ? (
                          <img 
                            src={epThumb} 
                            alt={ep.title} 
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : null}
                        <div style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(0, 102, 51, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffffff' }}>play_arrow</span>
                        </div>
                      </div>
                      
                      {/* Ep details */}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: 'var(--color-primary)',
                        }}>
                          {ep.title.startsWith('S') ? ep.title.split(':')[0] : `${t('episodePrefix')} ${ep.number}`}
                        </span>
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px',
                        }}>
                          {ep.title.includes(':') ? ep.title.split(':').slice(1).join(':').trim() : ep.title}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px dashed var(--glass-border)'
              }}>
                {t('loadingEpisodes')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
