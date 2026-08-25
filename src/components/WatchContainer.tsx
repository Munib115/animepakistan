'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { AnimeItem, Episode } from '@/types/anime';
import { StreamSource, sanitizeStreamUrl } from '@/lib/resolver';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { saveWatchProgress, getAnimeWatchProgress, WatchProgressItem } from '@/lib/watchHistory';
import { sound } from '@/lib/soundEngine';
import { useDownloads } from '@/context/DownloadContext';
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

  // Client-side stream resolver fallback if server was blocked by cloud datacenter firewalls
  useEffect(() => {
    setStreamSources(sources || []);
  }, [sources]);

  useEffect(() => {
    const hasValidStream = streamSources.some(s => s.url && s.url.startsWith('http'));
    
    if (!hasValidStream) {
      // Use the new animesalt-stream API with saltSlug + episode number + season
      const saltSlug = (anime as any).saltSlug || anime.slug;
      const epNumber = currentEpisode?.number || 1;
      const epSeason = currentEpisode?.season || (currentEpisode?.slug?.match(/(\d+)x\d+/i) ? parseInt(currentEpisode.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      const isMovie = anime.type === 'movie';
      
      const streamApiUrl = isMovie
        ? `/api/animesalt-stream?slug=${encodeURIComponent(saltSlug)}`
        : `/api/animesalt-stream?slug=${encodeURIComponent(saltSlug)}&ep=${epNumber}&season=${epSeason}`;

      fetch(streamApiUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data.sources && data.sources.length > 0) {
            setStreamSources(data.sources);
          } else {
            // Last resort: try the old resolve-stream route
            fetch(`/api/resolve-stream?url=${encodeURIComponent(targetEpisodeUrl)}`)
              .then(r => r.json())
              .then(d => { if (d.sources?.length > 0) setStreamSources(d.sources); })
              .catch(() => {});
          }
        })
        .catch(() => {
          fetch(`/api/resolve-stream?url=${encodeURIComponent(targetEpisodeUrl)}`)
            .then(r => r.json())
            .then(d => { if (d.sources?.length > 0) setStreamSources(d.sources); })
            .catch(() => {});
        });
    }
  }, [targetEpisodeUrl, targetSlug, anime.slug, currentEpisode?.number, currentEpisode?.season]);

  // Get the active mirror URL (abyssplayer.com, short.icu, or as-cdn26.top)
  const rawMirror = streamSources && streamSources.length > selectedServerIndex && streamSources[selectedServerIndex]?.url
    ? streamSources[selectedServerIndex].url
    : (streamSources && streamSources.length > 0 && streamSources[0]?.url ? streamSources[0].url : '');

  const activeMirror = sanitizeStreamUrl(rawMirror);

  const [isTheater, setIsTheater] = useState(false);
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Resume prompt state
  const [savedProgress, setSavedProgress] = useState<WatchProgressItem | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const watchSecondsRef = useRef(0);

  const displayName = language === 'en' 
    ? (anime.anilist?.englishName || anime.title) 
    : (anime.anilist?.romajiName || anime.anilist?.englishName || anime.title);

  const isMovie = anime.type === 'movie';

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

  // Season filter state in playlist
  const [selectedSeason, setSelectedSeason] = useState<number | 'ALL'>('ALL');

  // Filtered episodes for playlist view
  const visibleEpisodes = useMemo(() => {
    if (selectedSeason === 'ALL') return sortedEpisodes;
    return sortedEpisodes.filter((ep) => {
      const s = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)![1], 10) : 1);
      return s === selectedSeason;
    });
  }, [sortedEpisodes, selectedSeason]);

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
      poster: anime.poster,
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
        poster: anime.poster,
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
      } catch (e) {}
    }

    // Clear visual feedback after 750ms
    setTimeout(() => {
      setDoubleTapSide(null);
    }, 750);
  };

  // Double click / double tap handler
  const handlePlayerTap = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
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

  const handleReload = () => {
    setIframeKey((key) => key + 1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeek('right');
      } else if (e.key.toLowerCase() === 't') {
        setIsTheater((prev) => !prev);
      } else if (e.key.toLowerCase() === 'l') {
        setIsLightsOff((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '16px 0',
      position: 'relative',
    }}>
      
      {/* Lights Off Dimming Overlay */}
      {isLightsOff && (
        <div 
          onClick={() => setIsLightsOff(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            zIndex: 9998,
            backdropFilter: 'blur(10px)',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Top Header & Breadcrumbs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        position: 'relative',
        zIndex: isLightsOff ? 9999 : 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link 
            href={isMovie ? '/' : `/anime/${anime.slug}`}
            className="glass-btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '10px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {language === 'ur' ? 'arrow_forward' : 'arrow_back'}
            </span>
            <span>{isMovie ? t('home') : t('episodesList')}</span>
          </Link>

          <div>
            <h1 style={{
              fontSize: 'clamp(1.1rem, 3vw, 1.45rem)',
              fontWeight: 900,
              color: isLightsOff ? '#ffffff' : 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              {displayName}
            </h1>
            {!isMovie && currentEpisode && (
              <span style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
              }}>
                {currentEpisode.title}
              </span>
            )}
          </div>
        </div>

        {/* Badges & Download Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="glass-badge" style={{ background: 'var(--color-primary)', color: '#ffffff' }}>
            {isMovie ? (language === 'ur' ? 'مووی (MOVIE)' : 'MOVIE') : `${t('episodePrefix')} ${currentEpisode?.number || 1}`}
          </span>
          <span className="glass-badge-white">
            HD 1080p
          </span>

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
                width: '32px',
                height: '32px',
                borderRadius: '8px',
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
                boxShadow: '0 2px 8px rgba(0, 102, 51, 0.08)',
                transition: 'all 0.2s',
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
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '8px',
                  fontWeight: 900,
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #ffffff',
                }}>
                  {downloadingItem.progress}
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
          zIndex: isLightsOff ? 9999 : 2,
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

      {/* Main Liquid Glass Video Player Container */}
      <div 
        className="liquid-glass-panel" 
        style={{
          padding: '12px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(235,245,238,0.92) 100%)',
          border: '1.5px solid var(--glass-border)',
          boxShadow: '0 20px 50px rgba(0, 102, 51, 0.16)',
          position: 'relative',
          zIndex: isLightsOff ? 9999 : 2,
          maxWidth: isTheater ? '100%' : '100%',
          transform: 'translate3d(0,0,0)',
          willChange: 'transform',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 16:9 Screen Container with Liquid Glass Frame */}
        <div 
          onClick={handlePlayerTap}
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: isTheater ? '52%' : '56.25%', // Cinematic widescreen in theater mode
            background: '#010804',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 102, 51, 0.3)',
            cursor: 'pointer',
            transform: 'translate3d(0,0,0)',
          }}
        >
          {activeMirror ? (
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={activeMirror}
              title={displayName}
              allowFullScreen
              referrerPolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#000000',
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
              color: '#ffffff',
              gap: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '52px', color: 'var(--color-primary)' }}>
                play_circle
              </span>
              <p style={{ fontSize: '1rem', fontWeight: 700 }}>
                {t('connectingServer')}
              </p>
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

      {/* Player Navigation & Quick Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        position: 'relative',
        zIndex: isLightsOff ? 9999 : 2,
      }}>
        {/* Previous / Next Episode Quick Buttons */}
        {!isMovie && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {prevEp ? (
              <Link
                href={`/watch/${anime.slug}/${prevEp.slug}`}
                prefetch={true}
                onClick={() => sound.playEpisodeSelect()}
                className="glass-btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
                title={`Previous: S${prevEp.season || 1} Ep ${prevEp.number}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {language === 'ur' ? 'skip_next' : 'skip_previous'}
                </span>
                <span>{language === 'ur' ? 'پچھلی قسط' : 'Previous Ep'}</span>
              </Link>
            ) : (
              <button
                disabled
                className="glass-btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', opacity: 0.4, cursor: 'not-allowed' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {language === 'ur' ? 'skip_next' : 'skip_previous'}
                </span>
                <span>{language === 'ur' ? 'پچھلی قسط' : 'Previous Ep'}</span>
              </button>
            )}

            {nextEp ? (
              <Link
                href={`/watch/${anime.slug}/${nextEp.slug}`}
                prefetch={true}
                onClick={() => sound.playEpisodeSelect()}
                className="glass-btn"
                style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
                title={`Next: S${nextEp.season || 1} Ep ${nextEp.number}`}
              >
                <span>{language === 'ur' ? 'اگلی قسط' : 'Next Ep'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {language === 'ur' ? 'skip_previous' : 'skip_next'}
                </span>
              </Link>
            ) : null}
          </div>
        )}

        {/* Player Action Buttons: Reload, Theater, Lights */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <button
            onClick={handleReload}
            title="Reload Video Player"
            className="glass-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: '8px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            <span>{language === 'ur' ? 'ری لوڈ' : 'Reload'}</span>
          </button>

          <button
            onClick={() => setIsTheater((prev) => !prev)}
            title="Toggle Theater Mode (T)"
            className="glass-btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              borderRadius: '8px',
              background: isTheater ? 'var(--color-primary)' : undefined,
              color: isTheater ? '#ffffff' : undefined,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isTheater ? 'fullscreen_exit' : 'aspect_ratio'}
            </span>
            <span>{language === 'ur' ? 'تھیٹر موڈ' : 'Theater'}</span>
          </button>

          <button
            onClick={() => setIsLightsOff((prev) => !prev)}
            title="Toggle Lights Off (L)"
            className="glass-btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              borderRadius: '8px',
              background: isLightsOff ? '#1e293b' : undefined,
              color: isLightsOff ? '#fbbf24' : undefined,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isLightsOff ? 'lightbulb' : 'lightbulb_circle'}
            </span>
            <span>{language === 'ur' ? 'لائٹس آف' : 'Lights'}</span>
          </button>
        </div>
      </div>

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

            <span className="glass-badge">
              {visibleEpisodes.length} / {sortedEpisodes.length} {t('episodesSuffix')}
            </span>
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
                  background: selectedSeason === 'ALL' ? 'var(--color-primary)' : '#ffffff',
                  color: selectedSeason === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: selectedSeason === 'ALL' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {language === 'ur' ? 'تمام سیزنز (All Seasons)' : 'All Seasons'}
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
                  {language === 'ur' ? `سیزن ${s} (Season ${s})` : `Season ${s}`}
                </button>
              ))}
            </div>
          )}

          {/* Episode Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '10px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '4px',
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
                    background: isCurrent ? 'rgba(0, 102, 51, 0.08)' : '#ffffff',
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

      {/* Double Tap Seek Feedback Animations */}
      <style jsx>{`
        @keyframes seekRippleLeft {
          0% {
            opacity: 0;
            transform: scale(0.85);
          }
          40% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0;
            transform: scale(1.15);
          }
        }
        @keyframes seekRippleRight {
          0% {
            opacity: 0;
            transform: scale(0.85);
          }
          40% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

