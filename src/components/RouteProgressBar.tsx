'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sound } from '@/lib/soundEngine';

function RouteProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setVisible(true);
    setProgress(15);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + 14;
        if (prev < 80) return prev + 6;
        if (prev < 95) return prev + 1.5;
        return prev;
      });
    }, 100);
  };

  const finishProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setProgress(0), 250);
    }, 240);
  };

  // Route change completed
  useEffect(() => {
    finishProgress();
  }, [pathname, searchParams]);

  // Intercept client link clicks for instant visual feedback on page transition
  // and listen to popstate (browser/hardware back button) for sound and haptics
  useEffect(() => {
    const handlePopState = () => {
      sound.playBack();
      startProgress();
    };

    window.addEventListener('popstate', handlePopState);

    const handleAnchorClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;

      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !href.startsWith('/#') &&
        !target.getAttribute('target') &&
        !target.hasAttribute('download')
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          startProgress();
        }
      }
    };

    document.addEventListener('click', handleAnchorClick, { passive: true, capture: true });
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleAnchorClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999999,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #004d26 0%, #00cc66 50%, #00ff88 100%)',
          boxShadow: '0 0 14px #00ff88, 0 0 6px #00cc66',
          transition: progress === 100 ? 'width 0.12s ease-out' : 'width 0.22s cubic-bezier(0.1, 0.8, 0.2, 1)',
          position: 'relative',
        }}
      >
        {/* Leading edge light pulse aura */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '-2px',
            bottom: '-2px',
            width: '18px',
            background: 'radial-gradient(circle, #ffffff 10%, #00ff88 80%, transparent 100%)',
            borderRadius: '50%',
            filter: 'blur(1px)',
            opacity: progress < 100 ? 0.95 : 0,
          }}
        />
      </div>
    </div>
  );
}

export default function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBarInner />
    </Suspense>
  );
}
