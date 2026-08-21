'use client';

import React, { useEffect, useState } from 'react';

// Critical Top Backdrops & Posters to preload into GPU memory during splash screen
const CRITICAL_PRELOAD_IMAGES = [
  '/logo.png?v=ap2',
  '/icon-192.png',
];

export default function AppLoader() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    let isMounted = true;
    const startTime = performance.now();

    async function preloadAssets() {
      // 1. Progress to 35% on font ready
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          await document.fonts.ready;
          if (isMounted) setProgress((p) => Math.max(p, 40));
        } catch (e) {}
      }

      // 2. Discover and preload first visible Hero & Poster images from DOM or critical paths
      const imagePromises: Promise<void>[] = [];

      // Collect initial page image tags already in DOM
      const domImages = Array.from(document.querySelectorAll('img')).map((img) => img.src).filter(Boolean);
      const allUrls = Array.from(new Set([...CRITICAL_PRELOAD_IMAGES, ...domImages.slice(0, 8)]));

      allUrls.forEach((url) => {
        const p = new Promise<void>((resolve) => {
          const img = new Image();
          img.src = url;
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => {
              if ('decode' in img) {
                img.decode().then(resolve).catch(resolve);
              } else {
                resolve();
              }
            };
            img.onerror = () => resolve();
          }
        });
        imagePromises.push(p);
      });

      // Progressively increment progress bar
      let loadedCount = 0;
      imagePromises.forEach((p) => {
        p.then(() => {
          loadedCount++;
          if (isMounted) {
            const percent = 40 + Math.floor((loadedCount / Math.max(1, imagePromises.length)) * 55);
            setProgress((prev) => Math.max(prev, percent));
          }
        });
      });

      await Promise.allSettled(imagePromises);
      if (isMounted) setProgress(100);

      // Buttery smooth fadeout transition (min 600ms total splash for seamless transition)
      const elapsed = performance.now() - startTime;
      const delay = Math.max(80, 650 - elapsed);

      window.setTimeout(() => {
        if (!isMounted) return;
        setIsLeaving(true);
        window.setTimeout(() => {
          if (isMounted) setIsVisible(false);
        }, 520);
      }, delay);
    }

    preloadAssets();

    // Safety fallback timeout
    const fallback = window.setTimeout(() => {
      if (isMounted) {
        setProgress(100);
        setIsLeaving(true);
        window.setTimeout(() => {
          if (isMounted) setIsVisible(false);
        }, 520);
      }
    }, 2200);

    return () => {
      isMounted = false;
      window.clearTimeout(fallback);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`app-loader ${isLeaving ? 'is-leaving' : ''}`} 
      role="status" 
      aria-label="Loading Anime Pakistan"
    >
      <div className="app-loader-orb orb-one" />
      <div className="app-loader-orb orb-two" />
      
      <div className="app-loader-content">
        {/* 3D Liquid Glass Badge Mark */}
        <div className="app-loader-mark" style={{ width: '94px', height: '94px', maxWidth: '94px', maxHeight: '94px', overflow: 'hidden' }}>
          <img 
            src="/logo.png?v=ap2" 
            alt="Anime Pakistan" 
            style={{ width: '100%', height: '100%', maxWidth: '94px', maxHeight: '94px', objectFit: 'cover', borderRadius: '24px', display: 'block' }}
          />
          <span className="app-loader-ring" />
        </div>

        {/* Brand Title */}
        <p className="app-loader-brand">
          <span>ANIME</span> PAKISTAN
        </p>
        <p className="app-loader-caption">
          Urdu & Hindi Anime Streaming
        </p>

        {/* Real-time Dynamic Smooth Progress Bar */}
        <div className="app-loader-progress" aria-hidden="true">
          <span style={{ 
            width: `${progress}%`,
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}
