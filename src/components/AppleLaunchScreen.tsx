'use client';

import React, { useEffect, useState } from 'react';

export default function AppleLaunchScreen() {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);

  useEffect(() => {
    // Only display once per browser session to maintain instant navigation
    try {
      const alreadySeen = sessionStorage.getItem('ap_apple_launch_seen');
      if (alreadySeen) {
        setIsDestroyed(true);
        return;
      }
    } catch {
      // Fallback if sessionStorage is disabled/restricted
    }

    setMounted(true);

    // Ultra-fast Apple launch timing (~450ms active presentation)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      try {
        sessionStorage.setItem('ap_apple_launch_seen', '1');
      } catch {
        // Safe catch
      }
    }, 450);

    // Completely unmount from DOM after smooth fadeout transition (~720ms total)
    const destroyTimer = setTimeout(() => {
      setIsDestroyed(true);
    }, 720);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(destroyTimer);
    };
  }, []);

  if (!mounted || isDestroyed) {
    return null;
  }

  return (
    <div
      id="ap-apple-launch"
      className={`apple-launch-overlay ${isExiting ? 'apple-launch-exit' : ''}`}
      aria-hidden="true"
    >
      {/* Apple Ambient Center Aura */}
      <div className="apple-launch-ambient-aura" />

      <div className="apple-launch-stage">
        {/* Apple 3D Continuous Squircle Emblem */}
        <div className="apple-launch-squircle">
          <img
            src="/logo.webp"
            alt="Anime Pakistan"
            className="apple-launch-logo-img"
            width={76}
            height={76}
          />
          {/* Apple Specular Metallic Light Sheen Sweep */}
          <div className="apple-launch-sheen" />
        </div>

        {/* Minimalist Apple Typography */}
        <div className="apple-launch-brand">
          <span className="apple-launch-title">ANIME PAKISTAN</span>
          <span className="apple-launch-tag">اردو اور ہندی ڈبڈ اینیمے</span>
        </div>

        {/* Apple iOS Minimalist Capsule Progress Pill */}
        <div className="apple-launch-progress-track">
          <div className="apple-launch-progress-fill" />
        </div>
      </div>
    </div>
  );
}
