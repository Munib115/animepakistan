'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimeItem } from '@/types/anime';
import { useLanguage } from '@/context/LanguageContext';
import { getProxiedImageUrl } from '@/lib/image';
import { sound } from '@/lib/soundEngine';

interface AnimeCardProps {
  item: AnimeItem;
}

export default function AnimeCard({ item }: AnimeCardProps) {
  const { language } = useLanguage();
  const [imgError, setImgError] = useState(false);

  const displayName = language === 'en' 
    ? (item.anilist?.englishName || item.title) 
    : (item.anilist?.romajiName || item.anilist?.englishName || item.title);

  const watchHref = item.type === 'movie' ? `/watch/${item.slug}` : `/anime/${item.slug}`;
  
  const rawPoster = item.poster || item.anilist?.coverImage || '';
  const posterSrc = getProxiedImageUrl(rawPoster);

  const rating = item.anilist?.rating ? (item.anilist.rating / 10).toFixed(1) : null;
  const isMovie = item.type === 'movie';

  return (
    <div className="glass-card" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Link 
        href={watchHref} 
        onClick={() => sound.playCardClick()}
        style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        
        {/* Poster Container */}
        <div style={{
          width: '100%',
          paddingTop: '142%', // 1:1.42 anime poster aspect ratio
          position: 'relative',
          background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
          overflow: 'hidden',
        }}>
          {posterSrc && !imgError ? (
            <img
              src={posterSrc}
              alt={displayName}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
              padding: '12px',
              textAlign: 'center',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #004d26 0%, #006633 100%)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', marginBottom: '6px' }}>
                {isMovie ? 'movie' : 'live_tv'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>
                {displayName}
              </span>
            </div>
          )}

          {/* Top Floating Badges */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 2,
            pointerEvents: 'none',
          }}>
            {/* Type badge */}
            <span style={{
              background: isMovie ? '#006633' : '#059669',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}>
              {isMovie ? 'MOVIE' : 'SERIES'}
            </span>

            {/* Rating badge */}
            {rating && (
              <span style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(6px)',
                color: '#fbbf24',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>star</span>
                {rating}
              </span>
            )}
          </div>

          {/* Audio Languages Chips on Poster Bottom */}
          {item.audioLanguages && item.audioLanguages.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '6px',
              left: '6px',
              right: '6px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '3px',
              zIndex: 2,
            }}>
              {item.audioLanguages.slice(0, 2).map((lang) => (
                <span key={lang} style={{
                  background: 'rgba(0, 51, 25, 0.85)',
                  backdropFilter: 'blur(4px)',
                  color: '#e6f4ea',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  border: '0.5px solid rgba(255,255,255,0.2)',
                }}>
                  {lang}
                </span>
              ))}
              {item.audioLanguages.length > 2 && (
                <span style={{
                  background: 'rgba(0, 51, 25, 0.85)',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: '3px',
                }}>
                  +{item.audioLanguages.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Hover Play Button Overlay */}
          <div className="card-hover-overlay" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 102, 51, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.25s ease',
            zIndex: 3,
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#ffffff',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              transform: 'scale(0.85)',
              transition: 'transform 0.25s ease',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>play_arrow</span>
            </div>
          </div>
        </div>

        {/* Card Metadata Footer */}
        <div style={{
          padding: '10px 10px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'space-between',
          background: '#ffffff',
          gap: '6px',
        }}>
          <div>
            <h3 style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {displayName}
            </h3>

            {item.anilist?.year && (
              <span style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                marginTop: '2px',
                display: 'block',
              }}>
                {item.anilist.year}
              </span>
            )}
          </div>

          {/* Episode count for series */}
          {!isMovie && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: 'var(--color-primary)',
              fontWeight: 700,
              borderTop: '1px solid rgba(0, 102, 51, 0.08)',
              paddingTop: '6px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>playlist_play</span>
              <span>{item.episodes?.length || 0} ایپی سوڈز</span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
