'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimeItem } from '@/types/anime';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';

interface HeroSliderProps {
  items: AnimeItem[];
}

const SLIDE_DURATION = 6500;

export default function HeroSlider({ items }: HeroSliderProps) {
  const { t, language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const featured = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (items.length <= 8) return items;
    return items
      .filter((item) => item.backdrop || item.anilist?.bannerImage)
      .sort((a, b) => (b.anilist?.rating || 0) - (a.anilist?.rating || 0))
      .slice(0, 8);
  }, [items]);

  const nextSlide = useCallback(() => {
    setCurrentIndex((index) => featured.length ? (index + 1) % featured.length : 0);
  }, [featured.length]);

  const previousSlide = useCallback(() => {
    setCurrentIndex((index) => featured.length ? (index - 1 + featured.length) % featured.length : 0);
  }, [featured.length]);

  useEffect(() => {
    if (isPaused || featured.length < 2) return;
    const timer = window.setInterval(nextSlide, SLIDE_DURATION);
    return () => window.clearInterval(timer);
  }, [featured.length, isPaused, nextSlide]);

  useEffect(() => {
    if (currentIndex >= featured.length) setCurrentIndex(0);
  }, [currentIndex, featured.length]);

  if (!featured.length) return null;

  const current = featured[currentIndex];
  const displayName = language === 'en'
    ? current.anilist?.englishName || current.title
    : current.anilist?.romajiName || current.anilist?.englishName || current.title;
  // High-definition / 4K original master resolution for Hero Banner
  const backdrop = getProxiedImageUrl(current.backdrop || current.anilist?.bannerImage || current.poster, 'hero');
  const watchLink = current.type === 'movie' ? `/watch/${current.slug}` : `/anime/${current.slug}`;
  const detailsLink = current.type === 'movie' ? `/watch/${current.slug}` : `/anime/${current.slug}`;
  const rating = current.anilist?.rating ? (current.anilist.rating / 10).toFixed(1) : null;
  const description = (current.anilist?.description || current.description || 'Watch this featured title with Urdu and Hindi audio options.')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const metadata = [
    current.type === 'movie' ? 'Movie' : 'Series',
    current.anilist?.year?.toString(),
    rating ? `★ ${rating}` : undefined,
    current.audioLanguages?.slice(0, 2).join(' / '),
  ].filter(Boolean);

  // Preload adjacent slides so transitions are instantaneous and high-definition
  useEffect(() => {
    if (featured.length <= 1) return;
    const nextIdx = (currentIndex + 1) % featured.length;
    const prevIdx = (currentIndex - 1 + featured.length) % featured.length;
    [featured[nextIdx], featured[prevIdx]].forEach((item) => {
      if (!item) return;
      const url = getProxiedImageUrl(item.backdrop || item.anilist?.bannerImage || item.poster, 'hero');
      if (url && typeof window !== 'undefined') {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [currentIndex, featured]);

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const direction = touchStartX.current - touchEndX.current;
    if (Math.abs(direction) > 45) direction > 0 ? nextSlide() : previousSlide();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <section
      className="cinematic-hero"
      style={{ position: 'relative', overflow: 'hidden' }}
      aria-label="Featured anime"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(event) => { touchStartX.current = event.targetTouches[0].clientX; }}
      onTouchMove={(event) => { touchEndX.current = event.targetTouches[0].clientX; }}
      onTouchEnd={handleTouchEnd}
    >
      <img 
        key={current.slug} 
        className="cinematic-hero-image" 
        src={backdrop} 
        alt={displayName} 
        fetchPriority="high" 
        decoding="async"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
      />
      <div className={`cinematic-hero-scrim ${language === 'ur' ? 'rtl' : ''}`} />

      <div className={`cinematic-hero-content ${language === 'ur' ? 'rtl' : ''}`}>
        <div className="cinematic-hero-meta">
          {metadata.map((item) => <span key={item}>{item}</span>)}
        </div>
        <h2>{displayName}</h2>
        {current.genres?.length > 0 && (
          <p className="cinematic-hero-genres">{current.genres.slice(0, 3).join(' · ')}</p>
        )}
        <p className="cinematic-hero-description">{description}</p>
        <div className="cinematic-hero-actions">
          <Link href={watchLink} className="cinematic-hero-primary">
            <span className="material-symbols-outlined">play_arrow</span>
            <span>{t('watchNow')}</span>
          </Link>
          <Link href={detailsLink} className="cinematic-hero-secondary">
            <span className="material-symbols-outlined">info</span>
            <span>{t('details')}</span>
          </Link>
        </div>
      </div>

      {featured.length > 1 && (
        <>
          <button type="button" className="cinematic-hero-arrow previous" onClick={previousSlide} aria-label="Previous featured anime">
            <span className="material-symbols-outlined">navigate_before</span>
          </button>
          <button type="button" className="cinematic-hero-arrow next" onClick={nextSlide} aria-label="Next featured anime">
            <span className="material-symbols-outlined">navigate_next</span>
          </button>
          <div className="cinematic-hero-dots" aria-label="Featured anime slides">
            {featured.map((item, index) => (
              <button type="button" key={item.slug} onClick={() => setCurrentIndex(index)} aria-label={`Show slide ${index + 1}`} className={index === currentIndex ? 'active' : ''} />
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .cinematic-hero {
          position: relative;
          width: calc(100% - 32px);
          max-width: 1420px;
          min-height: 560px;
          height: clamp(540px, 66vh, 700px);
          margin: 12px auto 18px;
          overflow: hidden;
          isolation: isolate;
          border: 1px solid rgba(0, 102, 51, 0.18);
          border-radius: 26px;
          background: #020c06;
          box-shadow: 0 24px 60px -15px rgba(0, 55, 27, 0.35);
          user-select: none;
        }
        .cinematic-hero-image {
          position: absolute;
          z-index: -2;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 25%;
          animation: heroDrift ${SLIDE_DURATION}ms ease-out both;
          image-rendering: auto;
        }
        .cinematic-hero-scrim {
          position: absolute;
          z-index: -1;
          inset: 0;
          background: 
            linear-gradient(90deg, rgba(2, 15, 8, 0.95) 0%, rgba(2, 15, 8, 0.85) 48%, rgba(2, 15, 8, 0.45) 75%, rgba(2, 15, 8, 0.12) 100%), 
            linear-gradient(0deg, rgba(2, 15, 8, 0.88) 0%, rgba(2, 15, 8, 0.2) 65%);
        }
        .cinematic-hero-scrim.rtl {
          background: 
            linear-gradient(270deg, rgba(2, 15, 8, 0.96) 0%, rgba(2, 15, 8, 0.88) 48%, rgba(2, 15, 8, 0.48) 75%, rgba(2, 15, 8, 0.12) 100%), 
            linear-gradient(0deg, rgba(2, 15, 8, 0.88) 0%, rgba(2, 15, 8, 0.2) 65%);
        }
        .cinematic-hero-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          min-height: 560px;
          height: 100%;
          max-width: min(720px, 72%);
          padding: 48px 60px;
          color: #fff;
          z-index: 1;
        }
        .cinematic-hero-content.rtl {
          align-items: flex-start;
          text-align: right;
          direction: rtl;
          margin-inline-start: 0;
          margin-inline-end: auto;
        }
        .cinematic-hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .cinematic-hero-meta span, .cinematic-hero-genres { padding: 4px 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); color: rgba(255, 255, 255, 0.94); font-size: 0.78rem; font-weight: 700; }
        .cinematic-hero-content h2 { max-width: 650px; margin: 0 0 14px 0; color: #fff; font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.15; text-wrap: balance; text-shadow: 0 4px 24px rgba(0, 0, 0, 0.85); }
        .cinematic-hero-genres { display: inline-flex; align-items: center; margin: 0 0 14px 0; color: #9af0bc; }
        .cinematic-hero-description { display: -webkit-box; max-width: 620px; margin: 0 0 22px 0; overflow: hidden; color: rgba(255, 255, 255, 0.92); font-size: 0.98rem; line-height: 1.65; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9); -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
        .cinematic-hero-actions { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
        .cinematic-hero-actions :global(a) { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; gap: 8px; min-height: 48px; padding: 0 26px; border-radius: 14px; font-weight: 800; font-size: 0.92rem; transition: transform 160ms ease, background 160ms ease, border-color 160ms ease; cursor: pointer; color: #fff; text-decoration: none; }
        .cinematic-hero-actions :global(a):hover { transform: translateY(-2px); }
        .cinematic-hero-primary { background: #00994d; border: 1px solid rgba(255, 255, 255, 0.36); box-shadow: 0 10px 24px rgba(0, 153, 77, 0.36), inset 0 1px 1px rgba(255, 255, 255, 0.34); }
        .cinematic-hero-secondary { background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.34); backdrop-filter: blur(14px); }
        .cinematic-hero-arrow { position: absolute; top: 50%; z-index: 2; display: grid; place-items: center; width: 46px; height: 46px; border: 1px solid rgba(255, 255, 255, 0.38); border-radius: 50%; background: rgba(5, 18, 10, 0.56); backdrop-filter: blur(14px); color: #fff; cursor: pointer; transform: translateY(-50%); }
        .cinematic-hero-arrow.previous { inset-inline-start: 22px; } .cinematic-hero-arrow.next { inset-inline-end: 22px; }
        .cinematic-hero-dots { position: absolute; bottom: 20px; left: 50%; display: flex; gap: 8px; padding: 7px 12px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 999px; background: rgba(4, 18, 10, 0.55); backdrop-filter: blur(12px); transform: translateX(-50%); }
        .cinematic-hero-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 99px; background: rgba(255, 255, 255, 0.42); cursor: pointer; transition: width 180ms ease, background 180ms ease; }
        .cinematic-hero-dots button.active { width: 26px; background: #00d66b; }
        @keyframes heroDrift { from { transform: scale(1.01); } to { transform: scale(1.055); } }
        @media (max-width: 768px) {
          .cinematic-hero {
            width: calc(100% - 20px) !important;
            min-height: 480px !important;
            height: clamp(480px, 66vh, 580px) !important;
            max-height: 600px !important;
            margin: 8px auto 12px !important;
            left: 0 !important;
            right: 0 !important;
            margin-left: auto !important;
            margin-right: auto !important;
            border-radius: 22px !important;
            border: 1px solid rgba(0, 102, 51, 0.18) !important;
            box-shadow: 0 18px 45px -12px rgba(0, 45, 20, 0.35) !important;
          }
          .cinematic-hero-image {
            object-position: center 20% !important;
          }
          .cinematic-hero-scrim, .cinematic-hero-scrim.rtl {
            background: linear-gradient(0deg, rgba(2, 12, 6, 0.98) 0%, rgba(2, 12, 6, 0.78) 42%, rgba(2, 12, 6, 0.28) 72%, rgba(2, 12, 6, 0.05) 100%) !important;
          }
          .cinematic-hero-content, .cinematic-hero-content.rtl {
            justify-content: flex-end;
            min-height: 480px !important;
            height: 100% !important;
            max-height: 600px !important;
            max-width: 100%;
            padding: 22px 18px 28px !important;
            text-align: left;
            align-items: flex-start;
            margin: 0;
          }
          .cinematic-hero-content.rtl { text-align: right; align-items: flex-start; }
          .cinematic-hero-content h2 {
            font-size: clamp(1.3rem, 5.2vw, 1.75rem) !important;
            line-height: 1.2;
            margin: 0 0 8px 0;
            font-weight: 900;
            letter-spacing: -0.02em;
          }
          .cinematic-hero-meta {
            gap: 5px;
            margin-bottom: 8px;
          }
          .cinematic-hero-meta span {
            font-size: 0.68rem !important;
            padding: 3px 7px !important;
            border-radius: 6px !important;
            background: rgba(255, 255, 255, 0.14);
            border: 1px solid rgba(255, 255, 255, 0.22);
          }
          .cinematic-hero-meta span:nth-child(n+4) { display: none; }
          .cinematic-hero-genres {
            display: inline-flex !important;
            font-size: 0.72rem !important;
            margin-bottom: 6px !important;
            padding: 2px 6px !important;
          }
          .cinematic-hero-description {
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            font-size: 0.82rem !important;
            line-height: 1.45 !important;
            color: rgba(255, 255, 255, 0.88) !important;
            margin: 0 0 14px 0 !important;
          }
          .cinematic-hero-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 360px;
            margin-top: 4px;
            flex-wrap: nowrap;
          }
          .cinematic-hero-actions :global(a) {
            flex: 1;
            min-height: 42px !important;
            padding: 0 16px !important;
            border-radius: 12px !important;
            font-size: 0.84rem !important;
            font-weight: 800;
            justify-content: center;
          }
          .cinematic-hero-actions :global(.material-symbols-outlined) { font-size: 20px !important; }
          .cinematic-hero-arrow { display: none !important; }
          .cinematic-hero-dots {
            bottom: 8px !important;
            gap: 5px !important;
            padding: 4px 8px !important;
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.5);
          }
          .cinematic-hero-dots button { width: 5px; height: 5px; }
          .cinematic-hero-dots button.active { width: 16px; }
        }
      `}</style>
    </section>
  );
}
