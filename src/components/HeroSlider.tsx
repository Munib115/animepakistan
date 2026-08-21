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

  const featured = useMemo(() => items
    .filter((item) => item.backdrop || item.anilist?.bannerImage)
    .sort((a, b) => (b.anilist?.rating || 0) - (a.anilist?.rating || 0))
    .slice(0, 8), [items]);

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
  const backdrop = getProxiedImageUrl(current.backdrop || current.anilist?.bannerImage || current.poster);
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
      <img key={current.slug} className="cinematic-hero-image" src={backdrop} alt="" fetchPriority="high" />
      <div className={`cinematic-hero-scrim ${language === 'ur' ? 'rtl' : ''}`} />

      <div className={`cinematic-hero-content ${language === 'ur' ? 'rtl' : ''}`}>
        <div className="cinematic-hero-meta">
          {metadata.map((item) => <span key={item}>{item}</span>)}
        </div>
        <h1>{displayName}</h1>
        {current.genres?.length > 0 && (
          <p className="cinematic-hero-genres">{current.genres.slice(0, 3).join(' · ')}</p>
        )}
        <p className="cinematic-hero-description">{description}</p>
        <div className="cinematic-hero-actions">
          <Link href={watchLink} className="cinematic-hero-primary">
            <span className="material-symbols-outlined">play_arrow</span>
            {t('watchNow')}
          </Link>
          <Link href={detailsLink} className="cinematic-hero-secondary">
            <span className="material-symbols-outlined">info</span>
            {t('details')}
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
          width: 100vw;
          min-height: 580px;
          margin-left: calc(50% - 50vw);
          overflow: hidden;
          isolation: isolate;
          border: 0;
          border-radius: 0;
          background: #06120b;
          box-shadow: 0 24px 60px -24px rgba(0, 55, 27, 0.36);
          user-select: none;
        }
        .cinematic-hero-image {
          position: absolute;
          z-index: -2;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          animation: heroDrift ${SLIDE_DURATION}ms ease-out both;
        }
        .cinematic-hero-scrim {
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(90deg, rgba(2, 15, 8, 0.82) 0%, rgba(2, 15, 8, 0.7) 38%, rgba(2, 15, 8, 0.42) 72%, rgba(2, 15, 8, 0.32) 100%), linear-gradient(0deg, rgba(2, 15, 8, 0.62), rgba(2, 15, 8, 0.18) 58%);
        }
        .cinematic-hero-scrim.rtl { background: linear-gradient(270deg, rgba(2, 15, 8, 0.82) 0%, rgba(2, 15, 8, 0.7) 38%, rgba(2, 15, 8, 0.42) 72%, rgba(2, 15, 8, 0.32) 100%), linear-gradient(0deg, rgba(2, 15, 8, 0.62), rgba(2, 15, 8, 0.18) 58%); }
        .cinematic-hero-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          min-height: 580px;
          max-width: min(670px, 70%);
          padding: 56px 72px;
          color: #fff;
        }
        .cinematic-hero-content.rtl { align-items: flex-end; text-align: right; margin-left: auto; }
        .cinematic-hero-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
        .cinematic-hero-meta span, .cinematic-hero-genres { padding: 5px 9px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 7px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); color: rgba(255, 255, 255, 0.94); font-size: 0.75rem; font-weight: 700; }
        .cinematic-hero-content h1 { max-width: 650px; margin: 0; color: #fff; font-size: clamp(2.1rem, 5vw, 4.3rem); font-weight: 900; letter-spacing: -0.04em; line-height: 0.98; text-wrap: balance; text-shadow: 0 4px 24px rgba(0, 0, 0, 0.65); }
        .cinematic-hero-genres { display: inline-block; margin: 17px 0 0; color: #9af0bc; }
        .cinematic-hero-description { display: -webkit-box; max-width: 590px; margin: 18px 0 0; overflow: hidden; color: rgba(255, 255, 255, 0.86); font-size: 1rem; line-height: 1.65; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
        .cinematic-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
        .cinematic-hero-actions :global(a) { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 14px; font-weight: 800; transition: transform 160ms ease, background 160ms ease; }
        .cinematic-hero-actions :global(a):hover { transform: translateY(-2px); }
        .cinematic-hero-primary { background: #00994d; border: 1px solid rgba(255, 255, 255, 0.36); box-shadow: 0 10px 24px rgba(0, 153, 77, 0.36), inset 0 1px 1px rgba(255, 255, 255, 0.34); }
        .cinematic-hero-secondary { background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.34); backdrop-filter: blur(14px); }
        .cinematic-hero-arrow { position: absolute; top: 50%; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, 0.38); border-radius: 50%; background: rgba(5, 18, 10, 0.56); backdrop-filter: blur(14px); color: #fff; cursor: pointer; transform: translateY(-50%); }
        .cinematic-hero-arrow.previous { left: 20px; } .cinematic-hero-arrow.next { right: 20px; }
        .cinematic-hero-dots { position: absolute; bottom: 20px; left: 50%; display: flex; gap: 7px; padding: 7px 10px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 999px; background: rgba(4, 18, 10, 0.55); backdrop-filter: blur(12px); transform: translateX(-50%); }
        .cinematic-hero-dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 99px; background: rgba(255, 255, 255, 0.42); cursor: pointer; transition: width 180ms ease, background 180ms ease; }
        .cinematic-hero-dots button.active { width: 25px; background: #00d66b; }
        @keyframes heroDrift { from { transform: scale(1.01); } to { transform: scale(1.055); } }
        @media (max-width: 700px) {
          .cinematic-hero { width: 100%; min-height: 318px; margin-left: 0; border-radius: 19px; }
          .cinematic-hero-image { object-position: center 28%; image-rendering: auto; }
          .cinematic-hero-scrim, .cinematic-hero-scrim.rtl { background: linear-gradient(0deg, rgba(2, 15, 8, 0.96) 0%, rgba(2, 15, 8, 0.74) 49%, rgba(2, 15, 8, 0.08) 100%); }
          .cinematic-hero-content, .cinematic-hero-content.rtl { justify-content: flex-end; min-height: 318px; max-width: 100%; padding: 22px 13px 45px; text-align: left; align-items: flex-start; margin: 0; }
          .cinematic-hero-content h1 { max-width: 88%; font-size: clamp(1.48rem, 8.5vw, 2.15rem); line-height: 1; }
          .cinematic-hero-meta { gap: 4px; margin-bottom: 8px; } .cinematic-hero-meta span { font-size: 0.57rem; padding: 3px 5px; }
          .cinematic-hero-meta span:nth-child(n+4) { display: none; }
          .cinematic-hero-genres { margin-top: 7px; padding: 3px 6px; font-size: 0.58rem; }
          .cinematic-hero-description { margin-top: 7px; font-size: 0.7rem; line-height: 1.4; -webkit-line-clamp: 1; }
          .cinematic-hero-actions { width: 100%; gap: 7px; margin-top: 12px; } .cinematic-hero-actions :global(a) { min-height: 34px; padding: 0 10px; border-radius: 10px; font-size: 0.7rem; }
          .cinematic-hero-actions :global(.material-symbols-outlined) { font-size: 17px; }
          .cinematic-hero-arrow { top: 31%; width: 31px; height: 31px; } .cinematic-hero-arrow :global(.material-symbols-outlined) { font-size: 20px; } .cinematic-hero-arrow.previous { left: 7px; } .cinematic-hero-arrow.next { right: 7px; }
          .cinematic-hero-dots { bottom: 8px; gap: 4px; padding: 5px 8px; } .cinematic-hero-dots button { width: 5px; height: 5px; } .cinematic-hero-dots button.active { width: 17px; }
        }
      `}</style>
    </section>
  );
}
