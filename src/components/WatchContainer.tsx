'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { AnimeItem, Episode } from '@/types/anime';
import { StreamSource, sanitizeStreamUrl, isValidStreamEmbedUrl } from '@/lib/resolver';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { saveWatchProgress, getAnimeWatchProgress, WatchProgressItem } from '@/lib/watchHistory';
import { sound } from '@/lib/soundEngine';
import { useDownloads } from '@/context/DownloadContext';
import { isInWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { shareContent } from '@/lib/shareHelper';
import { adblockShield } from '@/lib/adblockShield';
import EpisodeComments from './EpisodeComments';

interface WatchContainerProps {
  anime: AnimeItem;
  currentEpisode?: Episode;
  sources: StreamSource[];
}

export default function WatchContainer({
  anime,
  currentEpisode,
  sources = [],
}: WatchContainerProps) {
  const { t, language } = useLanguage();
  const { downloads, startDownload } = useDownloads();

  const targetSlug = currentEpisode?.slug || anime.slug;
  const [streamSources, setStreamSources] = useState<StreamSource[]>(sources || []);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);

  const downloadId = `${anime.slug}-${currentEpisode?.slug || 'full-movie'}`;
  const downloadingItem = downloads.find((d) => d.id === downloadId);

  const [inList, setInList] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);

  // AdBlocker State (Background Sandbox Protection)
  const [isShieldActive, setIsShieldActive] = useState(true);

  useEffect(() => {
    setIsShieldActive(adblockShield.isEnabled());
    const handleShieldChange = () => {
      setIsShieldActive(adblockShield.isEnabled());
    };
    window.addEventListener('ap_adblock_changed', handleShieldChange);
    return () => {
      window.removeEventListener('ap_adblock_changed', handleShieldChange);
    };
  }, []);

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
      poster: resolvedPoster,
      type: isMovie ? 'movie' : 'series',
    });
    setInList(added);
  };

  const handleShareCurrent = async () => {
    sound.click();
    const title = isMovie
      ? displayName
      : `${displayName} - ${currentEpisode?.title || `Episode ${currentEpisode?.number || 1}`}`;
    const text = isMovie
      ? `Watch ${displayName} in Urdu & Hindi on AnimePakistan`
      : `Watch ${displayName} ${currentEpisode?.title || `Episode ${currentEpisode?.number || 1}`} in Urdu & Hindi on AnimePakistan`;
    const url = typeof window !== 'undefined' ? window.location.href : (currentEpisode ? `/watch/${anime.slug}/${currentEpisode.slug}` : `/watch/${anime.slug}`);
    await shareContent({ title, text, url });
    setIsShareCopied(true);
    setTimeout(() => setIsShareCopied(false), 2000);
  };

  const handleDownloadClick = () => {
    sound.playButton();
    if (!activeMirror) return;
    startDownload(
      anime.slug,
      currentEpisode?.slug || 'full-movie',
      displayName,
      currentEpisode?.title || 'Full Movie',
      activeMirror
    );
  };

  const targetEpisodeUrl = currentEpisode?.url || (anime.type === 'movie' ? `/watch/${anime.slug}` : `/watch/${anime.slug}/${targetSlug}`);

  // Filter stream sources strictly to only allow valid video embeds (never website pages)
  useEffect(() => {
    const valid = (sources || []).filter(s => s.url && isValidStreamEmbedUrl(s.url));
    setStreamSources(valid);
  }, [sources]);

  const [isRetryingStream, setIsRetryingStream] = useState(false);
  const [streamResolveTimeout, setStreamResolveTimeout] = useState(false);

  const fetchClientStreams = () => {
    const saltSlug = (anime as any).saltSlug || anime.slug;
    const epNumber = currentEpisode?.number || 1;
    const epSeason = currentEpisode?.season || (currentEpisode?.slug?.match(/(\d+)x\d+/i) ? parseInt(currentEpisode.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
    const isMovie = anime.type === 'movie';

    const streamApiUrl = isMovie
      ? `/api/animesalt-stream?slug=${encodeURIComponent(saltSlug)}`
      : `/api/animesalt-stream?slug=${encodeURIComponent(saltSlug)}&ep=${epNumber}&season=${epSeason}`;

    setIsRetryingStream(true);
    fetch(streamApiUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.sources && Array.isArray(data.sources)) {
          const valid = data.sources.filter((s: StreamSource) => s.url && isValidStreamEmbedUrl(s.url));
          if (valid.length > 0) {
            setStreamSources(valid);
            setStreamResolveTimeout(false);
          }
        }
      })
      .catch(() => { })
      .finally(() => setIsRetryingStream(false));
  };

  useEffect(() => {
    const hasValidStream = streamSources.some(s => s.url && isValidStreamEmbedUrl(s.url));
    if (!hasValidStream) {
      fetchClientStreams();
    }
  }, [targetEpisodeUrl, targetSlug, anime.slug, currentEpisode?.number, currentEpisode?.season]);

  // Timeout indicator for friendly reload UI
  useEffect(() => {
    const hasValidStream = streamSources.some(s => s.url && isValidStreamEmbedUrl(s.url));
    if (!hasValidStream) {
      const timer = setTimeout(() => {
        setStreamResolveTimeout(true);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setStreamResolveTimeout(false);
    }
  }, [streamSources]);

  // Filter only legitimate video embed sources
  const validStreamSources = useMemo(() => {
    return (streamSources || []).filter(s => s.url && isValidStreamEmbedUrl(s.url));
  }, [streamSources]);

  // Get active mirror URL strictly from valid sources
  const rawMirror = validStreamSources.length > selectedServerIndex && validStreamSources[selectedServerIndex]?.url
    ? validStreamSources[selectedServerIndex].url
    : (validStreamSources.length > 0 && validStreamSources[0]?.url
      ? validStreamSources[0].url
      : '');

  const activeMirror = isValidStreamEmbedUrl(rawMirror) ? sanitizeStreamUrl(rawMirror) : '';

  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Resume prompt state
  const [savedProgress, setSavedProgress] = useState<WatchProgressItem | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const watchSecondsRef = useRef(0);

  const displayName = language === 'en'
    ? (anime.anilist?.englishName || anime.title)
    : (anime.anilist?.romajiName || anime.anilist?.englishName || anime.title);

  const resolvedPoster = anime.poster || anime.anilist?.coverImage || anime.backdrop || '';
  const isMovie = anime.type === 'movie';

  // Reset iframe loaded state & register stream protection when activeMirror changes
  useEffect(() => {
    setIsIframeLoaded(false);
    if (activeMirror && isShieldActive) {
      adblockShield.recordStreamSession(activeMirror);
    }
  }, [activeMirror, isShieldActive]);

  // Periodic watch tick to suppress recurring background ads during video playback
  useEffect(() => {
    if (!activeMirror || !isShieldActive) return;
    const tickInterval = setInterval(() => {
      adblockShield.recordStreamWatchTick();
    }, 25000);
    return () => clearInterval(tickInterval);
  }, [activeMirror, isShieldActive]);

  // Sorted episodes list (Season asc, Number asc)
  const sortedEpisodes = useMemo(() => {
    if (!anime.episodes) return [];
    return [...anime.episodes].sort((a, b) => {
      const sA = a.season || (a.slug.match(/(\d+)x\d+/i) ? parseInt(a.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      const sB = b.season || (b.slug.match(/(\d+)x\d+/i) ? parseInt(b.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      if (sA !== sB) return sA - sB;
      return a.number - b.number;
    });
  }, [anime.episodes]);

  // Discover all seasons present in episodes
  const availableSeasons = useMemo(() => {
    const set = new Set<number>();
    sortedEpisodes.forEach((ep) => {
      const s = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      set.add(s);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sortedEpisodes]);

  // Season filter & sort order in playlist
  const [selectedSeason, setSelectedSeason] = useState<number | 'ALL'>('ALL');
  const [playlistSortOrder, setPlaylistSortOrder] = useState<'asc' | 'desc'>('asc');

  // Count episodes per season
  const seasonCounts = useMemo(() => {
    const map = new Map<number, number>();
    sortedEpisodes.forEach((ep) => {
      const s = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      map.set(s, (map.get(s) || 0) + 1);
    });
    return map;
  }, [sortedEpisodes]);

  // Filtered and sorted episodes for playlist view
  const visibleEpisodes = useMemo(() => {
    const list = selectedSeason === 'ALL'
      ? [...sortedEpisodes]
      : sortedEpisodes.filter((ep) => {
        const s = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
        return s === selectedSeason;
      });

    if (playlistSortOrder === 'desc') {
      return list.reverse();
    }
    return list;
  }, [sortedEpisodes, selectedSeason, playlistSortOrder]);

  // Navigation between episodes
  const currentIndex = isMovie
    ? -1
    : sortedEpisodes.findIndex((e) => e.slug === currentEpisode?.slug);

  const prevEp = !isMovie && currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null;
  const nextEp =
    !isMovie && currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1
      ? sortedEpisodes[currentIndex + 1]
      : null;

  // Check saved progress on mount
  useEffect(() => {
    const existing = getAnimeWatchProgress(anime.slug);
    if (existing && existing.progressPercent > 5 && existing.progressPercent < 95) {
      setSavedProgress(existing);
      setShowResumeBanner(true);
    }

    // Save initial view to history
    saveWatchProgress({
      animeSlug: anime.slug,
      animeTitle: displayName,
      poster: resolvedPoster,
      backdrop: anime.backdrop,
      type: anime.type,
      epSlug: currentEpisode?.slug,
      epTitle: currentEpisode?.title,
      epNumber: currentEpisode?.number,
      currentTime: existing ? existing.currentTime : 60,
      duration: existing ? existing.duration : 1440, // standard 24 min episode
      progressPercent: existing ? existing.progressPercent : 15,
    });

    // Periodic watch session ticker
    const interval = setInterval(() => {
      watchSecondsRef.current += 10;
      const calculatedDuration = 1440; // 24 mins
      const currentSeconds = (existing ? existing.currentTime : 0) + watchSecondsRef.current;
      const percent = Math.min(98, Math.max(5, Math.round((currentSeconds / calculatedDuration) * 100)));

      saveWatchProgress({
        animeSlug: anime.slug,
        animeTitle: displayName,
        poster: resolvedPoster,
        backdrop: anime.backdrop,
        type: anime.type,
        epSlug: currentEpisode?.slug,
        epTitle: currentEpisode?.title,
        epNumber: currentEpisode?.number,
        currentTime: currentSeconds,
        duration: calculatedDuration,
        progressPercent: percent,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [anime.slug, currentEpisode?.slug]);

  // Double tap state & visual animation feedback
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(10);
  const lastTapRef = React.useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  // Trigger 10s Seek (Forward / Backward)
  const handleSeek = (direction: 'left' | 'right') => {
    setDoubleTapSide(direction);
    setDoubleTapCount(10);

    // Send seek commands to iframe
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const seconds = direction === 'right' ? 10 : -10;
        iframeRef.current.contentWindow.postMessage({ type: 'seek', seconds, direction }, '*');
        iframeRef.current.contentWindow.postMessage({ event: 'command', func: 'seekBy', args: [seconds] }, '*');
        iframeRef.current.contentWindow.postMessage({ type: 'player:seek', seconds }, '*');
      } catch (e) { }
    }

    // Clear visual feedback after 750ms
    setTimeout(() => {
      setDoubleTapSide(null);
    }, 750);
  };

  // Double click / double tap handler
  const handlePlayerTap = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (isShieldActive) {
      adblockShield.recordPlayerInteraction();
    }
    const now = Date.now();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const target = e.currentTarget.getBoundingClientRect();
    const clickX = clientX - target.left;
    const isLeft = clickX < target.width * 0.45;
    const isRight = clickX > target.width * 0.55;

    if (now - lastTapRef.current.time < 350) {
      // Detected Double Tap!
      if (isLeft) {
        handleSeek('left');
      } else if (isRight) {
        handleSeek('right');
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
    }
  };

  // Keyboard shortcuts (arrow keys seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeek('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '12px 0',
      position: 'relative',
    }}>

      {/* Premium Curvy Glass Header Card */}
      <div 
        className="watch-header-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '20px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Left: Curvy Back Icon + Full Detail Titles */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          flex: '1 1 260px',
        }}>
          <Link
            href={isMovie ? '/' : `/anime/${anime.slug}`}
            title={isMovie ? t('home') : t('episodesList')}
            aria-label={isMovie ? t('home') : t('episodesList')}
            className="glass-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              minWidth: '38px',
              borderRadius: '50%',
              padding: 0,
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {language === 'ur' ? 'arrow_forward' : 'arrow_back'}
            </span>
          </Link>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.25rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.25,
              margin: 0,
              letterSpacing: '-0.02em',
              wordBreak: 'break-word',
            }}>
              {displayName}
            </h1>
            {!isMovie && currentEpisode && (
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginTop: '2px',
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}>
                {currentEpisode.title}
              </div>
            )}
          </div>
        </div>

        {/* Right: Curvy Badges & Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span
            className="glass-badge"
            style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
              borderRadius: '999px',
              padding: '4px 12px',
              fontWeight: 800,
              fontSize: '0.74rem',
              letterSpacing: '0.02em',
              boxShadow: '0 2px 8px rgba(0, 102, 51, 0.2)',
            }}
          >
            {isMovie ? (language === 'ur' ? 'مووی (MOVIE)' : 'MOVIE') : `${t('episodePrefix')} ${currentEpisode?.number || 1}`}
          </span>
          <span
            className="glass-badge-white"
            style={{
              borderRadius: '999px',
              padding: '4px 10px',
              fontWeight: 800,
              fontSize: '0.72rem',
            }}
          >
            HD 1080p
          </span>

          {/* Add to Watchlist Button */}
          <button
            type="button"
            onClick={handleWatchlistToggle}
            title={inList ? (language === 'ur' ? 'لسٹ میں محفوظ ہے' : 'In Watchlist') : (language === 'ur' ? 'لسٹ میں شامل کریں' : 'Add to List')}
            aria-label={inList ? 'In Watchlist' : 'Add to List'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: inList ? '1.5px solid #00ff66' : '1px solid var(--glass-border)',
              background: inList ? 'rgba(0, 102, 51, 0.25)' : 'var(--bg-secondary)',
              color: inList ? 'var(--color-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: inList ? '#00ff66' : 'inherit' }}>
              {inList ? 'bookmark_added' : 'bookmark_add'}
            </span>
          </button>

          {/* Share Current Video / Episode Button */}
          <button
            type="button"
            onClick={handleShareCurrent}
            title={isShareCopied ? (language === 'ur' ? 'لنک کاپی ہوگیا' : 'Link Copied!') : (isMovie ? (language === 'ur' ? 'مووی شیئر کریں' : 'Share Movie') : (language === 'ur' ? 'ایپی سوڈ شیئر کریں' : 'Share Episode'))}
            aria-label="Share"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: isShareCopied ? '1.5px solid #16a34a' : '1px solid var(--glass-border)',
              background: isShareCopied ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-secondary)',
              color: isShareCopied ? '#16a34a' : 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {isShareCopied ? 'check' : 'share'}
            </span>
          </button>

          {/* Small Icon-Only Download Button */}
          {streamSources.length > 0 && (
            <button
              onClick={handleDownloadClick}
              disabled={downloadingItem?.status === 'downloading' || downloadingItem?.status === 'paused'}
              title={downloadingItem ? `Download: ${downloadingItem.progress}%` : 'Download Video'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: 'none',
                background: downloadingItem
                  ? downloadingItem.status === 'completed'
                    ? '#16a34a'
                    : 'rgba(0, 102, 51, 0.15)'
                  : 'var(--color-primary)',
                color: downloadingItem
                  ? downloadingItem.status === 'completed'
                    ? '#ffffff'
                    : 'var(--color-primary)'
                  : '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 102, 51, 0.25)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {downloadingItem
                  ? downloadingItem.status === 'completed'
                    ? 'download_done'
                    : 'downloading'
                  : 'download'}
              </span>

              {downloadingItem && downloadingItem.status !== 'completed' && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--color-glow)',
                  color: '#000000',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  borderRadius: '999px',
                  padding: '1px 4px',
                  lineHeight: 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}>
                  {downloadingItem.progress}%
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Continue Watching / Resume Notification Banner */}
      {showResumeBanner && savedProgress && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 16px',
          background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.95) 0%, rgba(3, 30, 15, 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 255, 102, 0.4)',
          boxShadow: '0 4px 16px rgba(0, 102, 51, 0.3)',
          color: '#ffffff',
          position: 'relative',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00ff66' }}>
              play_circle
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {language === 'ur'
                ? `آپ نے پچھلی بار یہ ویڈیو ${savedProgress.progressPercent}٪ تک دیکھی تھی۔`
                : `You previously watched up to ${savedProgress.progressPercent}% of this video.`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setShowResumeBanner(false);
                handleSeek('right');
              }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#00ff66',
                color: '#011508',
                fontSize: '0.75rem',
                fontWeight: 900,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fast_forward</span>
              <span>{language === 'ur' ? `وہیں سے چلائیں (${savedProgress.progressPercent}٪)` : `Resume (${savedProgress.progressPercent}%)`}</span>
            </button>

            <button
              onClick={() => setShowResumeBanner(false)}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Video Player Container */}
      <div
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#010804',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 102, 51, 0.25)',
          position: 'relative',
          zIndex: 2,
          transform: 'translate3d(0,0,0)',
          willChange: 'transform',
        }}
      >
        {/* 16:9 Screen Container */}
        <div
          onClick={handlePlayerTap}
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%',
            background: '#010804',
            overflow: 'hidden',
            cursor: 'pointer',
            transform: 'translate3d(0,0,0)',
          }}
        >
          {activeMirror ? (
            <>
              {/* Sleek Liquid Glass Loader until iframe is ready */}
              {!isIframeLoaded && (
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
                  background: 'linear-gradient(135deg, #010c05 0%, #031c0e 100%)',
                  zIndex: 4,
                  gap: '12px',
                  color: '#ffffff',
                }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    border: '3px solid rgba(0, 204, 102, 0.2)',
                    borderTopColor: 'var(--color-glow)',
                    animation: 'spin-loader 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, letterSpacing: '0.04em', color: '#e6f7ec' }}>
                    {language === 'ur' ? 'ویڈیو لوڈ ہو رہی ہے...' : 'Loading video stream...'}
                  </span>
                </div>
              )}

              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={activeMirror}
                title={displayName}
                allowFullScreen
                loading="eager"
                onLoad={() => setIsIframeLoaded(true)}
                referrerPolicy="no-referrer"
                sandbox={isShieldActive
                  ? "allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                  : "allow-scripts allow-same-origin allow-presentation allow-fullscreen allow-popups allow-forms"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#000000',
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              />
            </>
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
              color: '#ffffff',
              gap: '14px',
              padding: '24px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #010c05 0%, #031c0e 100%)',
            }}>
              {!streamResolveTimeout ? (
                <>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    border: '3px solid rgba(0, 204, 102, 0.2)',
                    borderTopColor: 'var(--color-glow)',
                    animation: 'spin-loader 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                    {t('connectingServer')}
                  </p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '42px', color: 'var(--color-primary)' }}>
                    sync_problem
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '4px' }}>
                      {language === 'ur' ? 'سرور اسٹریم ہم آہنگ ہو رہی ہے' : 'Stream Synchronizing'}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '360px', margin: '0 auto' }}>
                      {language === 'ur'
                        ? 'ویڈیو کنکشن بحال کرنے کیلئے نیچے دیے گئے بٹن پر کلک کریں۔'
                        : 'The high-speed stream server is reconnecting. Click below to retry.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchClientStreams}
                    disabled={isRetryingStream}
                    className="glass-btn-primary"
                    style={{
                      padding: '8px 20px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      borderRadius: '10px',
                      cursor: isRetryingStream ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: isRetryingStream ? 'spin-loader 1s linear infinite' : 'none' }}>
                      refresh
                    </span>
                    <span>{isRetryingStream ? (language === 'ur' ? 'لوڈ ہو رہا ہے...' : 'Retrying...') : (language === 'ur' ? 'دوبارہ کوشش کریں' : 'Retry Server')}</span>
                  </button>
                </>
              )}
            </div>
          )}



          {/* Top Left Watermark: MUNIB UR REHMAN (Liquid Glass, Non-intrusive) */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(3, 20, 10, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '3px 8px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            opacity: 0.72,
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00ff66',
              boxShadow: '0 0 6px #00ff66',
            }} />
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#ffffff',
              textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}>
              Munib ur Rehman
            </span>
          </div>

          {/* Top Right Live Streaming Status Indicator */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(0, 102, 51, 0.65)',
            backdropFilter: 'blur(8px)',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.62rem',
            fontWeight: 800,
            color: '#6ee7b7',
            letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <span>4K ULTRA HD</span>
          </div>
        </div>
      </div>

      {/* Player Navigation Bar — Previous / Next Episode */}
      {!isMovie && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 2,
        }}>
          {prevEp ? (
            <Link
              href={`/watch/${anime.slug}/${prevEp.slug}`}
              prefetch={true}
              onClick={() => sound.playEpisodeSelect()}
              className="glass-btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title={`Previous: S${prevEp.season || 1} Ep ${prevEp.number}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                {language === 'ur' ? 'skip_next' : 'skip_previous'}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{language === 'ur' ? 'پچھلی قسط' : 'Prev Ep'}</span>
            </Link>
          ) : (
            <button
              disabled
              className="glass-btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '8px', opacity: 0.38, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                {language === 'ur' ? 'skip_next' : 'skip_previous'}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{language === 'ur' ? 'پچھلی قسط' : 'Prev Ep'}</span>
            </button>
          )}

          {nextEp && (
            <Link
              href={`/watch/${anime.slug}/${nextEp.slug}`}
              prefetch={true}
              onClick={() => sound.playEpisodeSelect()}
              className="glass-btn"
              style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title={`Next: S${nextEp.season || 1} Ep ${nextEp.number}`}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{language === 'ur' ? 'اگلی قسط' : 'Next Ep'}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                {language === 'ur' ? 'skip_previous' : 'skip_next'}
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Series Episodes Playlist Organized by Season */}
      {!isMovie && sortedEpisodes.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            <h2 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>playlist_play</span>
              <span>{t('episodesList')} ({sortedEpisodes.length})</span>
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  sound.pop();
                  setPlaylistSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                }}
                className="glass-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '6px',
                  background: playlistSortOrder === 'desc' ? 'rgba(0, 102, 51, 0.18)' : 'var(--bg-secondary)',
                  border: playlistSortOrder === 'desc' ? '1px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  color: playlistSortOrder === 'desc' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {playlistSortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
                <span>
                  {playlistSortOrder === 'desc'
                    ? (language === 'ur' ? 'نئے پہلے' : 'Newest First')
                    : (language === 'ur' ? 'پرانے پہلے' : 'Oldest First')}
                </span>
              </button>

              <span className="glass-badge">
                {visibleEpisodes.length} / {sortedEpisodes.length} {t('episodesSuffix')}
              </span>
            </div>
          </div>

          {/* Season Selection Tabs (if multi-season) */}
          {availableSeasons.length > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              marginBottom: '14px',
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
                  background: selectedSeason === 'ALL' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: selectedSeason === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: selectedSeason === 'ALL' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {language === 'ur' ? `تمام سیزنز (${sortedEpisodes.length})` : `All Seasons (${sortedEpisodes.length})`}
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

          {/* Episode Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
            gap: '8px',
            maxHeight: '420px',
            overflowY: 'auto',
            paddingRight: '2px',
          }}>
            {visibleEpisodes.map((ep) => {
              const isCurrent = ep.slug === currentEpisode?.slug;
              const fallbackThumb = anime.poster || anime.backdrop || '';
              const epThumb = getProxiedImageUrl(ep.thumbnail) || fallbackThumb;
              const epSeason = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
              const cleanTitle = ep.title
                .replace(/S\d+E\d+.*$/i, '')
                .replace(/1080p.*$/i, '')
                .replace(/\.mkv|\.mp4/gi, '')
                .trim() || `Episode ${ep.number}`;

              return (
                <Link
                  key={ep.slug}
                  href={`/watch/${anime.slug}/${ep.slug}`}
                  prefetch={true}
                  onClick={() => sound.playEpisodeSelect()}
                  className={`glass-card ${isCurrent ? 'active-ep-card' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    textDecoration: 'none',
                    border: isCurrent ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                    background: isCurrent ? 'rgba(0, 102, 51, 0.18)' : 'var(--bg-secondary)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{
                    width: '64px',
                    height: '40px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
                    flexShrink: 0,
                  }}>
                    {epThumb && (
                      <img
                        src={epThumb}
                        alt={cleanTitle}
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
                    )}
                    {isCurrent ? (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 102, 51, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffffff' }}>volume_up</span>
                      </div>
                    ) : (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }} className="play-hover-overlay">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffffff' }}>play_arrow</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        background: 'rgba(0, 102, 51, 0.08)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}>
                        S{epSeason}:E{ep.number}
                      </span>
                      {isCurrent && (
                        <span style={{
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          color: '#ffffff',
                          background: 'var(--color-primary)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}>
                          {language === 'ur' ? 'چل رہا ہے' : 'PLAYING'}
                        </span>
                      )}
                    </div>

                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '3px',
                    }}>
                      {cleanTitle}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Episode Discussions & Voice Notes */}
      <EpisodeComments
        animeSlug={anime.slug}
        episodeSlug={currentEpisode?.slug || 'full-movie'}
        episodeTitle={currentEpisode?.title}
      />

    </div>
  );
}

