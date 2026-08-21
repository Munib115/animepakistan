'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimeItem, Episode } from '@/types/anime';
import { StreamSource } from '@/lib/resolver';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { saveWatchProgress, getAnimeWatchProgress, WatchProgressItem } from '@/lib/watchHistory';
import { sound } from '@/lib/soundEngine';
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

  // Active mirror stream
  const [activeMirror, setActiveMirror] = useState<string>(
    sources.length > 0 ? sources[0].url : ''
  );
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

  // Navigation between episodes
  const currentIndex = isMovie
    ? -1
    : (anime.episodes || []).findIndex((e) => e.slug === currentEpisode?.slug);

  const prevEp = !isMovie && currentIndex > 0 ? anime.episodes![currentIndex - 1] : null;
  const nextEp =
    !isMovie && currentIndex >= 0 && currentIndex < (anime.episodes || []).length - 1
      ? anime.episodes![currentIndex + 1]
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

        {/* Badges */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="glass-badge" style={{ background: 'var(--color-primary)', color: '#ffffff' }}>
            {isMovie ? (language === 'ur' ? 'مووی (MOVIE)' : 'MOVIE') : `${t('episodePrefix')} ${currentEpisode?.number || 1}`}
          </span>
          <span className="glass-badge-white">
            HD 1080p
          </span>
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
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
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

      {/* Series Episodes Playlist Grid */}
      {!isMovie && anime.episodes && anime.episodes.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
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
              <span>{t('episodesList')} ({anime.episodes.length})</span>
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '10px',
            maxHeight: '380px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}>
            {anime.episodes.map((ep) => {
              const isCurrent = ep.slug === currentEpisode?.slug;
              const epThumb = getProxiedImageUrl(ep.thumbnail) || anime.poster;
              return (
                <Link
                  key={ep.slug}
                  href={`/watch/${anime.slug}/${ep.slug}`}
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
                    width: '60px',
                    height: '38px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
                    flexShrink: 0,
                  }}>
                    {epThumb && (
                      <img 
                        src={epThumb} 
                        alt={ep.title} 
                        loading="lazy" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    )}
                    {isCurrent && (
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
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {ep.title}
                    </span>
                    <span style={{
                      fontSize: '0.62rem',
                      color: isCurrent ? 'var(--color-primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {isCurrent ? 'Now Playing' : `Ep ${ep.number}`}
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

