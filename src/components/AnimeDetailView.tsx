'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { AnimeItem, Episode } from '@/types/anime';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { sound } from '@/lib/soundEngine';
import { isInWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { shareContent } from '@/lib/shareHelper';

interface AnimeDetailViewProps {
  anime: AnimeItem;
  relatedAnime?: AnimeItem[];
}

export default function AnimeDetailView({ anime, relatedAnime = [] }: AnimeDetailViewProps) {
  const { t, language } = useLanguage();
  const [selectedSeason, setSelectedSeason] = useState<number | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [inList, setInList] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [copiedEpSlug, setCopiedEpSlug] = useState<string | null>(null);

  const displayName = language === 'en'
    ? (anime.anilist?.englishName || anime.title)
    : (anime.anilist?.romajiName || anime.anilist?.englishName || anime.title);

  const nativeName = anime.anilist?.nativeName || '';
  const description = anime.anilist?.description
    ? anime.anilist.description.replace(/<[^>]*>?/gm, '')
    : anime.description || t('detailsComingSoon');

  const rawCover = anime.poster || anime.anilist?.coverImage || '';
  const rawBanner = anime.anilist?.bannerImage || anime.backdrop || '';
  
  const coverUrl = getProxiedImageUrl(rawCover, 'poster');
  const bannerUrl = getProxiedImageUrl(rawBanner, 'backdrop');
  
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

  // Episode counts per season for informative badges
  const seasonCounts = useMemo(() => {
    const map = new Map<number, number>();
    anime.episodes?.forEach((ep) => {
      const s = ep.season || (ep.title.match(/^S(\d+)/i) ? parseInt(ep.title.match(/^S(\d+)/i)![1], 10) : (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1));
      map.set(s, (map.get(s) || 0) + 1);
    });
    return map;
  }, [anime.episodes]);

  // Filter and sort episodes by season, sort order, and search query
  const filteredEpisodes = useMemo(() => {
    if (!anime.episodes) return [];
    return anime.episodes
      .filter((ep) => {
        // 1. Season filter
        if (selectedSeason !== 'ALL') {
          const epSeason = ep.season || (ep.title.match(/^S(\d+)/i) ? parseInt(ep.title.match(/^S(\d+)/i)![1], 10) : (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1));
          if (epSeason !== selectedSeason) return false;
        }

        // 2. Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return ep.title.toLowerCase().includes(q) || ep.slug.toLowerCase().includes(q) || String(ep.number).includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        const sA = a.season || (a.slug.match(/(\d+)x\d+/i) ? parseInt(a.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
        const sB = b.season || (b.slug.match(/(\d+)x\d+/i) ? parseInt(b.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
        if (sortOrder === 'desc') {
          if (sA !== sB) return sB - sA;
          return b.number - a.number;
        } else {
          if (sA !== sB) return sA - sB;
          return a.number - b.number;
        }
      });
  }, [anime.episodes, selectedSeason, searchQuery, sortOrder]);

  useEffect(() => {
    if (!anime?.slug) return;
    setInList(isInWatchlist(anime.slug));
    const handleWatchlistUpdate = () => {
      if (anime?.slug) setInList(isInWatchlist(anime.slug));
    };
    window.addEventListener('ap_watchlist_updated', handleWatchlistUpdate);
    return () => window.removeEventListener('ap_watchlist_updated', handleWatchlistUpdate);
  }, [anime?.slug]);

  const handleWatchlistToggle = () => {
    if (!anime?.slug) return;
    sound.pop();
    const added = toggleWatchlist({
      slug: anime.slug,
      title: displayName,
      poster: rawCover,
      type: isMovie ? 'movie' : 'series',
    });
    setInList(added);
  };

  const handleShareAnime = async () => {
    sound.click();
    const currentUrl = typeof window !== 'undefined' ? window.location.href : `/anime/${anime.slug}`;
    await shareContent({
      title: displayName,
      text: `Watch ${displayName} in Urdu & Hindi on AnimePakistan`,
      url: currentUrl,
    });
    setIsShareCopied(true);
    setTimeout(() => setIsShareCopied(false), 2000);
  };

  const handleShareEpisode = async (ep: Episode) => {
    sound.click();
    const epUrl = typeof window !== 'undefined' ? `${window.location.origin}/watch/${anime.slug}/${ep.slug}` : `/watch/${anime.slug}/${ep.slug}`;
    await shareContent({
      title: `${displayName} - ${ep.title}`,
      text: `Watch ${displayName} ${ep.title} in Urdu & Hindi on AnimePakistan`,
      url: epUrl,
    });
    setCopiedEpSlug(ep.slug);
    setTimeout(() => setCopiedEpSlug(null), 2000);
  };

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
                borderRadius: '22px',
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

              {/* Action Buttons Column Under Poster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                {isMovie ? (
                  <Link 
                    href={`/watch/${anime.slug}`}
                    className="glass-btn"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '0.90rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontWeight: 800,
                    }}
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    <span>{t('playMovie')}</span>
                  </Link>
                ) : (filteredEpisodes.length > 0 || (anime.episodes && anime.episodes.length > 0)) ? (
                  <Link 
                    href={`/watch/${anime.slug}/${filteredEpisodes[0]?.slug || anime.episodes?.[0]?.slug}`}
                    className="glass-btn"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '0.90rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontWeight: 800,
                    }}
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    <span>{language === 'ur' ? 'ایپی سوڈ 1 دیکھیں' : 'Watch Episode 1'}</span>
                  </Link>
                ) : null}

                {/* Add to List & Share Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleWatchlistToggle}
                    className="glass-btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '10px 14px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: inList ? '1.5px solid #00ff66' : '1px solid var(--glass-border)',
                      background: inList ? 'rgba(0, 102, 51, 0.15)' : 'var(--bg-secondary)',
                      color: inList ? 'var(--color-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    title={inList ? 'In Watchlist' : 'Add to List'}
                    aria-label={inList ? 'In Watchlist' : 'Add to List'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: inList ? 'var(--color-primary)' : 'inherit' }}>
                      {inList ? 'bookmark_added' : 'bookmark_add'}
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {inList ? (language === 'ur' ? 'محفوظ' : 'In List') : (language === 'ur' ? 'لسٹ میں شامل' : 'Add to List')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareAnime}
                    className="glass-btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '10px 14px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: isShareCopied ? '1.5px solid #16a34a' : '1px solid var(--glass-border)',
                      background: isShareCopied ? 'rgba(22, 163, 74, 0.12)' : 'var(--bg-secondary)',
                      color: isShareCopied ? '#16a34a' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    title={isShareCopied ? 'Link Copied' : 'Share Anime'}
                    aria-label="Share Anime"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {isShareCopied ? 'check' : 'share'}
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {isShareCopied ? (language === 'ur' ? 'کاپی ہوگیا' : 'Copied') : (language === 'ur' ? 'شیئر' : 'Share')}
                    </span>
                  </button>
                </div>
              </div>
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
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    padding: '4px 10px',
                    borderRadius: '999px',
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
                    padding: '5px 12px',
                    borderRadius: '999px',
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
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)',
                        padding: '4px 12px',
                        borderRadius: '999px',
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
                background: 'var(--bg-secondary)',
                padding: '18px 20px',
                borderRadius: '20px',
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
          <div className="glass-panel" style={{ padding: '24px 20px', marginBottom: '24px' }}>
            
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
                      padding: '7px 16px',
                      borderRadius: '999px',
                      border: selectedSeason === 'ALL' ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                      background: selectedSeason === 'ALL' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                      color: selectedSeason === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: selectedSeason === 'ALL' ? 800 : 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    {language === 'ur' ? `تمام سیزنز (${anime.episodes?.length || 0})` : `All Seasons (${anime.episodes?.length || 0})`}
                  </button>

                  {availableSeasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSeason(s);
                        sound.playTabSwitch();
                      }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '999px',
                        border: selectedSeason === s ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                        background: selectedSeason === s ? 'var(--color-primary)' : 'var(--bg-secondary)',
                        color: selectedSeason === s ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: selectedSeason === s ? 800 : 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                      }}
                    >
                      {language === 'ur' ? `سیزن ${s} (${seasonCounts.get(s) || 0} اقساط)` : `Season ${s} (${seasonCounts.get(s) || 0} eps)`}
                    </button>
                  ))}
                </div>
              )}

              {/* Controls Bar: Search Box + Sort Order Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}>
                {/* Search Box */}
                {(anime.episodes?.length || 0) > 6 && (
                  <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
                    <span className="material-symbols-outlined" style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '18px',
                      color: 'var(--text-muted)',
                    }}>
                      search
                    </span>
                    <input
                      type="text"
                      placeholder={language === 'ur' ? 'قسط نمبر یا عنوان تلاش کریں...' : 'Search episode title or number...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input"
                      style={{
                        width: '100%',
                        padding: '9px 16px 9px 36px',
                        fontSize: '0.82rem',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                )}

                {/* Sort Order Toggle Button */}
                {(anime.episodes?.length || 0) > 1 && (
                  <button
                    onClick={() => {
                      sound.pop();
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    className="glass-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '999px',
                      background: sortOrder === 'desc' ? 'rgba(0, 102, 51, 0.18)' : 'var(--bg-secondary)',
                      border: sortOrder === 'desc' ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                      color: sortOrder === 'desc' ? 'var(--color-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                    <span>
                      {sortOrder === 'desc'
                        ? (language === 'ur' ? 'نئے پہلے (Newest First)' : 'Newest First')
                        : (language === 'ur' ? 'پرانے پہلے (Oldest First)' : 'Oldest First')}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {filteredEpisodes.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '12px',
              }}>
                {filteredEpisodes.map((ep) => {
                  const fallbackThumb = coverUrl || bannerUrl || anime.poster || anime.backdrop || '';
                  const epThumb = getProxiedImageUrl(ep.thumbnail) || fallbackThumb;
                  const cleanEpisodeTitle = ep.title
                    .replace(/S\d+E\d+.*$/i, '')
                    .replace(/1080p.*$/i, '')
                    .replace(/\.mkv|\.mp4/gi, '')
                    .trim() || `${t('episodePrefix')} ${ep.number}`;

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
                        padding: '12px',
                        textDecoration: 'none',
                        borderRadius: '18px',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{
                        width: '80px',
                        height: '50px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative',
                        background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
                        flexShrink: 0,
                      }}>
                        {epThumb ? (
                          <img 
                            src={epThumb} 
                            alt={cleanEpisodeTitle} 
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              if (fallbackThumb && e.currentTarget.src !== fallbackThumb) {
                                e.currentTarget.src = fallbackThumb;
                              }
                            }}
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
                          {cleanEpisodeTitle.includes(':') ? cleanEpisodeTitle.split(':').slice(1).join(':').trim() : cleanEpisodeTitle}
                        </span>
                      </div>

                      {/* Share Episode Icon Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleShareEpisode(ep);
                        }}
                        title={copiedEpSlug === ep.slug ? (language === 'ur' ? 'لنک کاپی ہوگیا' : 'Link Copied!') : (language === 'ur' ? 'ایپی سوڈ شیئر کریں' : 'Share Episode')}
                        aria-label="Share Episode"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          border: copiedEpSlug === ep.slug ? '1.5px solid #16a34a' : '1px solid var(--glass-border)',
                          background: copiedEpSlug === ep.slug ? 'rgba(22, 163, 74, 0.12)' : 'var(--bg-secondary)',
                          color: copiedEpSlug === ep.slug ? '#16a34a' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.18s ease',
                          zIndex: 2,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {copiedEpSlug === ep.slug ? 'check' : 'share'}
                        </span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                borderRadius: '18px',
                border: '1px dashed var(--glass-border)'
              }}>
                {t('loadingEpisodes')}
              </div>
            )}
          </div>
        )}

        {/* Franchise & Related Series / Movies Row */}
        {relatedAnime && relatedAnime.length > 0 && (
          <div className="glass-panel" style={{ padding: '20px 20px 22px', marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>movie_filter</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {language === 'ur' ? 'متعلقہ فرنچائز اور سیریز' : 'Franchise & Related Series'}
                </h3>
              </div>
              <span className="glass-badge">
                {relatedAnime.length} {language === 'ur' ? 'شوز دستیاب' : 'Titles Available'}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
            }}>
              {relatedAnime.map((item) => {
                const itemCover = getProxiedImageUrl(item.poster || item.anilist?.coverImage || '', 'poster');
                const itemTitle = item.anilist?.englishName || item.title;
                const isMovieItem = item.type === 'movie';
                const targetHref = isMovieItem ? `/watch/${item.slug}` : `/anime/${item.slug}`;

                return (
                  <Link
                    key={item.slug}
                    href={targetHref}
                    prefetch={true}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px',
                      borderRadius: '18px',
                      textDecoration: 'none',
                      gap: '8px',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      position: 'relative',
                    }}>
                      {itemCover ? (
                        <img
                          src={itemCover}
                          alt={itemTitle}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <span className="material-symbols-outlined">movie</span>
                        </div>
                      )}
                      <span style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: isMovieItem ? 'rgba(220, 38, 38, 0.88)' : 'rgba(0, 102, 51, 0.88)',
                        color: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        backdropFilter: 'blur(4px)',
                      }}>
                        {isMovieItem ? (language === 'ur' ? 'مکمل مووی' : 'Movie') : `${item.episodeCount || item.episodes?.length || 0} ${language === 'ur' ? 'اقساط' : 'Eps'}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {itemTitle}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        {isMovieItem ? (language === 'ur' ? 'مکمل مووی' : 'Full Movie') : (language === 'ur' ? 'تمام اقساط' : 'All Episodes')}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
