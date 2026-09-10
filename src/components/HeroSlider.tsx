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
        .cinematic-hero-arrow {
          position: absolute;
          top: 50%;
          z-index: 5;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(255, 255, 255, 0.38);
          border-radius: 50%;
          background: rgba(5, 18, 10, 0.56);
          backdrop-filter: blur(14px);
          color: #fff;
          cursor: pointer;
          transform: translateY(-50%);
        }
        .cinematic-hero-arrow.previous { inset-inline-start: 18px; }
        .cinematic-hero-arrow.next { inset-inline-end: 18px; }
        .cinematic-hero-dots {
          position: absolute;
          bottom: 16px;
          left: 50%;
          z-index: 5;
          display: flex;
          gap: 7px;
          padding: 6px 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: rgba(4, 18, 10, 0.55);
          backdrop-filter: blur(12px);
          transform: translateX(-50%);
        }
        .cinematic-hero-dots button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.42);
          cursor: pointer;
          transition: width 180ms ease, background 180ms ease;
        }
        .cinematic-hero-dots button.active {
          width: 24px;
          background: #00d66b;
        }
        @media (max-width: 768px) {
          .cinematic-hero-arrow { display: none !important; }
          .cinematic-hero-dots {
            bottom: 6px !important;
            gap: 5px !important;
            padding: 3px 7px !important;
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
