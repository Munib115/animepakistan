'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isGameFullyCached, downloadGameAssets, downloadRomFile } from '@/lib/gameCacheManager';
import { sound } from '@/lib/soundEngine';

export type GraphicsMode = 'saiyan-hdr' | 'crisp-hd' | 'retro-crt' | 'classic';

export interface GraphicsPreset {
  name: string;
  shortName: string;
  icon: string;
  accent: string;
  badge: string;
  description: string;
}

export const GRAPHICS_MODES: Record<GraphicsMode, GraphicsPreset> = {
  'saiyan-hdr': {
    name: 'Super Saiyan HDR',
    shortName: 'Saiyan HDR',
    icon: 'flare',
    accent: '#fbbf24',
    badge: 'HDR',
    description: 'Vibrant Anime Colors, High Contrast & Ki Aura Glow',
  },
  'crisp-hd': {
    name: 'Crisp HD Smooth',
    shortName: 'Crisp HD',
    icon: 'auto_fix_high',
    accent: '#00e575',
    badge: 'HD',
    description: 'Anti-Aliased Sprites & Smooth Character Edges',
  },
  'retro-crt': {
    name: 'Retro Arcade CRT',
    shortName: 'Arcade CRT',
    icon: 'tv',
    accent: '#38bdf8',
    badge: 'CRT',
    description: '240p Phosphor Scanlines & Authentic Curved Glass Glow',
  },
  'classic': {
    name: 'Classic GBA (2004)',
    shortName: 'Original GBA',
    icon: 'videogame_asset',
    accent: '#a78bfa',
    badge: 'RAW',
    description: 'Pixel-Perfect Original 240×160 Raw Pixels',
  },
};

export default function OfflineArcadePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isDownloadingCache, setIsDownloadingCache] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [cacheCurrentLabel, setCacheCurrentLabel] = useState('');
  const [emulatorLoaded, setEmulatorLoaded] = useState(false);
  const [emulatorError, setEmulatorError] = useState<string | null>(null);
  const [graphicsMode, setGraphicsMode] = useState<GraphicsMode>('saiyan-hdr');
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const arcadeContainerRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLDivElement>(null);
  const ejsScriptRef = useRef<HTMLScriptElement | null>(null);

  // Load saved graphics preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ap_gba_graphics_mode') as GraphicsMode;
      if (saved && GRAPHICS_MODES[saved]) {
        setGraphicsMode(saved);
      }
    } catch {}
  }, []);

  const cycleGraphicsMode = useCallback(() => {
    sound.playButton();
    sound.haptic(20);
    const keys: GraphicsMode[] = ['saiyan-hdr', 'crisp-hd', 'retro-crt', 'classic'];
    setGraphicsMode((curr) => {
      const nextIdx = (keys.indexOf(curr) + 1) % keys.length;
      const next = keys[nextIdx];
      try {
        localStorage.setItem('ap_gba_graphics_mode', next);
      } catch {}

      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setHudMessage(`${GRAPHICS_MODES[next].name} • ${GRAPHICS_MODES[next].description}`);
      hudTimerRef.current = setTimeout(() => {
        setHudMessage(null);
      }, 2600);

      return next;
    });
  }, []);

  // ── Stop the emulator completely (audio + engine + DOM) ──────────────────
  const stopEmulator = useCallback(() => {
    try {
      const ejs = (window as any).EJS_emulator;
      if (ejs) {
        // Pause / stop the game loop
        if (typeof ejs.pause === 'function') ejs.pause();
        if (typeof ejs.stop === 'function') ejs.stop();
        if (typeof ejs.exit === 'function') ejs.exit();
        // Kill the game manager if present
        if (ejs.gameManager) {
          if (typeof ejs.gameManager.pause === 'function') ejs.gameManager.pause();
          if (typeof ejs.gameManager.exit === 'function') ejs.gameManager.exit();
        }
      }
    } catch { /* ignore */ }

    // Suspend ALL Web Audio contexts — this kills any lingering sound
    try {
      const win = window as any;
      // EmulatorJS stores its AudioContext here
      if (win.EJS_emulator?.audioContext) {
        win.EJS_emulator.audioContext.suspend();
        win.EJS_emulator.audioContext.close();
      }
      // Also close any global audio context that leaked
      if (win.AudioContext) {
        document.querySelectorAll('audio, video').forEach((el) => {
          const media = el as HTMLMediaElement;
          media.pause();
          media.src = '';
        });
      }
    } catch { /* ignore */ }

    // Remove the EmulatorJS loader script from the page
    if (ejsScriptRef.current && ejsScriptRef.current.parentNode) {
      ejsScriptRef.current.parentNode.removeChild(ejsScriptRef.current);
      ejsScriptRef.current = null;
    }

    // Remove any style/script tags injected by EmulatorJS itself
    document.querySelectorAll('script[src*="emulatorjs"], link[href*="emulatorjs"]')
      .forEach((el) => el.remove());

    // Blank the canvas so the last frame doesn't linger
    const canvas = document.getElementById('gba-game-canvas');
    if (canvas) canvas.innerHTML = '';

    // Clear all EmulatorJS global state
    const ejsKeys = Object.keys(window).filter((k) => k.startsWith('EJS_'));
    ejsKeys.forEach((k) => { try { delete (window as any)[k]; } catch { } });
  }, []);

  // Connectivity monitoring
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if offline game is already cached in browser
    isGameFullyCached().then((cached) => setIsCached(cached));
    const handleCacheUpdated = () => setIsCached(true);
    window.addEventListener('ap-game-cache-updated', handleCacheUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ap-game-cache-updated', handleCacheUpdated);
    };
  }, []);

  // Toggle audio mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      const ejs = (window as any).EJS_emulator;
      if (ejs && typeof ejs.setVolume === 'function') {
        ejs.setVolume(next ? 0 : 0.9);
      }
      return next;
    });
  }, []);

  // Initialize self-hosted EmulatorJS
  useEffect(() => {
    const startEmulator = () => {
      try {
        (window as any).EJS_player = '#gba-game-canvas';
        (window as any).EJS_core = 'gba';
        (window as any).EJS_gameUrl = '/roms/dbz-supersonic-warriors.gba';
        (window as any).EJS_pathtodata = '/emulatorjs/';
        (window as any).EJS_gameName = 'Dragon Ball Z: Supersonic Warriors';
        (window as any).EJS_color = '#00e575';
        (window as any).EJS_startOnLoaded = true;
        (window as any).EJS_volume = isMuted ? 0 : 0.9;
        (window as any).EJS_alignStartButton = 'center';
        (window as any).EJS_noAutoFocus = false;
        (window as any).EJS_disableDatabases = false;
        (window as any).EJS_language = 'en-US';
        (window as any).EJS_disableAutoLang = true;
        (window as any).EJS_VirtualGamepadSettings = [0];
        (window as any).EJS_defaultControls = {
          0: {
            0: { value: 'x', value2: 'BUTTON_2' }, // B
            1: { value: 's', value2: 'BUTTON_4' },
            2: { value: 'shift', value2: 'SELECT' },
            3: { value: 'enter', value2: 'START' },
            4: { value: 'up arrow', value2: 'DPAD_UP' },
            5: { value: 'down arrow', value2: 'DPAD_DOWN' },
            6: { value: 'left arrow', value2: 'DPAD_LEFT' },
            7: { value: 'right arrow', value2: 'DPAD_RIGHT' },
            8: { value: 'z', value2: 'BUTTON_1' }, // A
            9: { value: 'a', value2: 'BUTTON_3' },
            10: { value: 'q', value2: 'LEFT_TOP_SHOULDER' }, // L (Charge Ki)
            11: { value: 'e', value2: 'RIGHT_TOP_SHOULDER' }, // R (Super Dash)
          },
          1: {}, 2: {}, 3: {}
        };
        (window as any).EJS_ready = () => setEmulatorLoaded(true);
        (window as any).EJS_onGameStart = () => setEmulatorLoaded(true);

        const script = document.createElement('script');
        script.src = '/emulatorjs/loader.js';
        script.async = true;
        script.onload = () => setEmulatorLoaded(true);
        script.onerror = () =>
          setEmulatorError('Could not load local GBA emulator engine. Please ensure files are cached.');
        ejsScriptRef.current = script;
        document.body.appendChild(script);
      } catch (err: any) {
        setEmulatorError(err?.message || 'Failed to initialize emulator');
      }
    };

    const rafId = requestAnimationFrame(startEmulator);

    // Cleanup: stop emulator when component unmounts (e.g. navigating away)
    return () => {
      cancelAnimationFrame(rafId);
      stopEmulator();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!arcadeContainerRef.current) return;
    if (!document.fullscreenElement) {
      arcadeContainerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Virtual Gamepad Haptic Touch Handler
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  // EmulatorJS key code & direct gamepad simulation mapping (GBA mapping)
  // GBA Joypad IDs: 0=B, 8=A, 10=L (Charge Ki), 11=R (Super Dash), 4=UP, 5=DOWN, 6=LEFT, 7=RIGHT, 3=START, 2=SELECT
  const sendKey = useCallback((key: string, keyCode: number, isDown: boolean) => {
    triggerHaptic();
    const eventType = isDown ? 'keydown' : 'keyup';

    // Build proper code string (e.g. ArrowUp, KeyZ, KeyX, Enter, ShiftLeft)
    let code = key;
    if (key === 'ArrowUp') code = 'ArrowUp';
    else if (key === 'ArrowDown') code = 'ArrowDown';
    else if (key === 'ArrowLeft') code = 'ArrowLeft';
    else if (key === 'ArrowRight') code = 'ArrowRight';
    else if (key === 'Enter') code = 'Enter';
    else if (key === 'Shift') code = 'ShiftLeft';
    else if (key.length === 1) code = 'Key' + key.toUpperCase();

    const makeEvent = () => {
      const evt = new KeyboardEvent(eventType, {
        key,
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(evt, 'keyCode', { get: () => keyCode });
      Object.defineProperty(evt, 'which', { get: () => keyCode });
      return evt;
    };

    const evt = makeEvent();

    // 1. Dispatch on the emulator canvas element
    const canvas = document.getElementById('gba-game-canvas');
    if (canvas) canvas.dispatchEvent(evt);

    // 2. Dispatch on document and window
    document.dispatchEvent(evt);
    window.dispatchEvent(evt);

    // 3. Direct EmulatorJS input synchronization
    const ejs = (window as any).EJS_emulator;
    if (ejs) {
      // Direct call to EmulatorJS internal key handler
      if (typeof ejs.keyChange === 'function') {
        try {
          ejs.keyChange(evt);
        } catch {}
      }

      // Direct simulation into libretro core via button ID
      const buttonMap: Record<number, number[]> = {
        88: [0],     // 'x' -> B button
        90: [8],     // 'z' -> A button
        81: [10],    // 'q' -> L shoulder (Charge Ki)
        69: [11],    // 'e' -> R shoulder (Super Dash)
        65: [10],    // 'a' fallback for L
        83: [11],    // 's' fallback for R
        38: [4],     // Up
        40: [5],     // Down
        37: [6],     // Left
        39: [7],     // Right
        13: [3],     // Enter (Start)
        16: [2],     // Shift (Select)
        86: [2],     // 'v' (Select)
      };

      const ids = buttonMap[keyCode];
      if (ids) {
        if (ejs.gameManager && typeof ejs.gameManager.simulateInput === 'function') {
          try {
            ids.forEach((id) => ejs.gameManager.simulateInput(0, id, isDown ? 1 : 0));
          } catch {}
        }
        if (typeof ejs.simulateInput === 'function') {
          try {
            ids.forEach((id) => ejs.simulateInput(0, id, isDown ? 1 : 0));
          } catch {}
        }
      }
    }
  }, []);

  // Manual download handler for offline game cache
  const handleDownloadOfflineGame = async () => {
    if (isDownloadingCache) return;
    setIsDownloadingCache(true);
    setCacheProgress(0);
    const success = await downloadGameAssets((pct, label) => {
      setCacheProgress(pct);
      setCacheCurrentLabel(label);
    });
    setIsDownloadingCache(false);
    if (success) {
      setIsCached(true);
    }
  };

  return (
    <div className="offline-page-root" ref={arcadeContainerRef}>
      {/* Sleek Professional Top Arcade Header */}
      <header className="arcade-header">
        {/* Left: Exit/Home button & Brand */}
        <div className="arcade-header-left">
          <button
            type="button"
            className="arcade-nav-btn back-btn"
            aria-label="Return to Homepage"
            title="Return to Homepage"
            onClick={() => {
              sound.playBack();
              stopEmulator();
              router.push('/');
            }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="back-btn-text">Exit</span>
          </button>

          <div className="arcade-brand-divider" />

          <div className="arcade-brand">
            <div className="arcade-brand-icon">
              <img src="/logo.webp" alt="Anime Pakistan Logo" />
            </div>
            <div className="arcade-brand-titles">
              <div className="arcade-title-row">
                <span className="brand-anime">ANIME</span>
                <span className="brand-pakistan">PAKISTAN</span>
                <span className="brand-pill-badge">ARCADE</span>
              </div>
              <span className="arcade-subtitle">Dragon Ball Z • Offline GBA</span>
            </div>
          </div>
        </div>

        {/* Center: Connectivity & Cache Status Pill */}
        <div className="arcade-header-center">
          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className={`status-dot ${isOnline ? 'dot-green' : 'dot-amber'}`} />
            <span className="status-text">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>

          <button
            type="button"
            className={`cache-status-pill ${isCached ? 'cached' : 'not-cached'}`}
            onClick={() => {
              sound.click();
              setShowOfflineModal(true);
            }}
            title={isCached ? 'Game cached in browser. Click to manage storage.' : 'Click to download and save game for offline use.'}
          >
            <span className="material-symbols-outlined status-pill-icon">
              {isCached ? 'verified' : 'cloud_download'}
            </span>
            <span className="cache-pill-label">
              {isCached ? 'Saved Offline' : 'Save Offline (16MB)'}
            </span>
          </button>
        </div>

        {/* Right: Actions (Sound, Controls Guide, Fullscreen) */}
        <div className="arcade-header-right">
          <button
            type="button"
            className={`action-btn ${isMuted ? 'muted' : ''}`}
            onClick={() => {
              sound.click();
              toggleMute();
            }}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            <span className="material-symbols-outlined">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          <button
            type="button"
            className="action-btn gfx-mode-btn"
            onClick={cycleGraphicsMode}
            title={`Graphics Mode: ${GRAPHICS_MODES[graphicsMode].name} — Click to cycle enhancement`}
            aria-label="Cycle Graphics Enhancement Mode"
          >
            <span className="material-symbols-outlined" style={{ color: GRAPHICS_MODES[graphicsMode].accent, fontSize: '18px' }}>
              {GRAPHICS_MODES[graphicsMode].icon}
            </span>
            <span className="btn-label-desktop">{GRAPHICS_MODES[graphicsMode].shortName}</span>
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => {
              sound.click();
              setShowControlsHelp(!showControlsHelp);
            }}
            title="Controller & Keyboard Guide"
            aria-label="Controls Guide"
          >
            <span className="material-symbols-outlined">sports_esports</span>
            <span className="btn-label-desktop">Controls</span>
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => {
              sound.click();
              toggleFullscreen();
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label="Fullscreen"
          >
            <span className="material-symbols-outlined">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Arcade Frame */}
      <main className="arcade-stage">
        <div className={`gba-console-bezel bezel-aura-${graphicsMode}`} ref={gameFrameRef}>
          {/* Bezel Top: Classic GBA Accent */}
          <div className="bezel-top-bar">
            <div className="gba-power-indicator">
              <div className="power-led" />
              <span className="power-label">POWER</span>
            </div>
            <div className="gba-metallic-logo">
              <span className="gba-brand">ANIME PAKISTAN</span>
              <span className="gba-model">GBA ARCADE</span>
            </div>
            <div className="bezel-top-right">
              <button
                type="button"
                className="bezel-gfx-pill"
                onClick={cycleGraphicsMode}
                title="Click to switch graphics mode"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: GRAPHICS_MODES[graphicsMode].accent }}>
                  {GRAPHICS_MODES[graphicsMode].icon}
                </span>
                <span>{GRAPHICS_MODES[graphicsMode].badge}</span>
              </button>
              <div className="gba-speaker-grille">
                <span /><span /><span />
              </div>
            </div>
          </div>

          {/* Screen Display Bezel with Real-Time Graphics Enhancement */}
          <div className={`gba-screen-viewport gfx-mode-${graphicsMode}`}>
            <div id="gba-game-canvas" className="gba-canvas-target" />

            {/* Retro CRT Scanline Shader Overlay */}
            {graphicsMode === 'retro-crt' && (
              <div className="crt-scanline-shader" />
            )}

            {/* Super Saiyan Ki Aura VFX Glow */}
            {graphicsMode === 'saiyan-hdr' && (
              <div className="saiyan-aura-glow" />
            )}

            {/* Transient Graphics HUD Notification Toast */}
            {hudMessage && (
              <div className="gfx-hud-pill">
                <span className="material-symbols-outlined" style={{ color: GRAPHICS_MODES[graphicsMode].accent, fontSize: '16px' }}>
                  {GRAPHICS_MODES[graphicsMode].icon}
                </span>
                <span>{hudMessage}</span>
              </div>
            )}

            {/* Loading / Ready state */}
            {!emulatorLoaded && !emulatorError && (
              <div
                className="screen-loading-overlay"
                onClick={() => setEmulatorLoaded(true)}
                title="Click to start game"
              >
                <div className="loading-monogram">
                  <span className="dragon-ball-badge">DBZ</span>
                  <div className="loading-spinner" />
                </div>
                <h3>Dragon Ball Z: Supersonic Warriors</h3>
                <p>Loading self-hosted WebAssembly GBA core...</p>
                <span className="cache-note">Works 100% Offline • Click anywhere to play</span>
              </div>
            )}

            {emulatorError && (
              <div className="screen-error-overlay">
                <span className="material-symbols-outlined">warning</span>
                <h3>Emulator Offline Cache Notice</h3>
                <p>{emulatorError}</p>
                <button
                  type="button"
                  className="retry-btn"
                  onClick={() => window.location.reload()}
                >
                  Reload Game
                </button>
              </div>
            )}
          </div>

          {/* Bezel Bottom: Game Details & Quick Controls */}
          <div className="bezel-bottom-bar">
            <span className="game-label">DRAGON BALL Z - SUPERSONIC WARRIORS</span>
            <div className="bezel-shortcuts">
              <button
                type="button"
                className="gfx-bezel-badge"
                onClick={cycleGraphicsMode}
                title="Click to switch Graphics Mode"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: GRAPHICS_MODES[graphicsMode].accent }}>
                  {GRAPHICS_MODES[graphicsMode].icon}
                </span>
                <span>GFX: {GRAPHICS_MODES[graphicsMode].name}</span>
              </button>
              <span className="shortcut-pill">Z: B-Attack</span>
              <span className="shortcut-pill">X: A-Heavy</span>
              <span className="shortcut-pill">Q: L-Charge</span>
              <span className="shortcut-pill">E: R-Dash</span>
              <span className="shortcut-pill">Enter: Start</span>
            </div>
          </div>
        </div>

        {/* Mobile Tactile Virtual Gamepad (Visible on mobile/touch screens via CSS) */}
        <div className="mobile-touch-gamepad">
            {/* L & R Shoulder Triggers — Q=L, E=R in EmulatorJS GBA mapping */}
            <div className="gamepad-shoulders-row">
              <button
                type="button"
                className="shoulder-trigger-btn left"
                onTouchStart={(e) => { e.preventDefault(); sendKey('q', 81, true); }}
                onTouchEnd={(e) => { e.preventDefault(); sendKey('q', 81, false); }}
                onMouseDown={() => sendKey('q', 81, true)}
                onMouseUp={() => sendKey('q', 81, false)}
              >
                <span>L · Charge Ki</span>
              </button>

              <button
                type="button"
                className="shoulder-trigger-btn right"
                onTouchStart={(e) => { e.preventDefault(); sendKey('e', 69, true); }}
                onTouchEnd={(e) => { e.preventDefault(); sendKey('e', 69, false); }}
                onMouseDown={() => sendKey('e', 69, true)}
                onMouseUp={() => sendKey('e', 69, false)}
              >
                <span>R · Super Dash</span>
              </button>
            </div>

            {/* Lower Row: D-Pad, Start/Select, Action Buttons */}
            <div className="gamepad-main-row">
              {/* Directional D-Pad */}
              <div className="virtual-dpad">
                <button
                  type="button"
                  className="dpad-btn up"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('ArrowUp', 38, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('ArrowUp', 38, false); }}
                  onMouseDown={() => sendKey('ArrowUp', 38, true)}
                  onMouseUp={() => sendKey('ArrowUp', 38, false)}
                  aria-label="Up"
                >▲</button>
                <div className="dpad-horizontal">
                  <button
                    type="button"
                    className="dpad-btn left"
                    onTouchStart={(e) => { e.preventDefault(); sendKey('ArrowLeft', 37, true); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey('ArrowLeft', 37, false); }}
                    onMouseDown={() => sendKey('ArrowLeft', 37, true)}
                    onMouseUp={() => sendKey('ArrowLeft', 37, false)}
                    aria-label="Left"
                  >◀</button>
                  <div className="dpad-center" />
                  <button
                    type="button"
                    className="dpad-btn right"
                    onTouchStart={(e) => { e.preventDefault(); sendKey('ArrowRight', 39, true); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey('ArrowRight', 39, false); }}
                    onMouseDown={() => sendKey('ArrowRight', 39, true)}
                    onMouseUp={() => sendKey('ArrowRight', 39, false)}
                    aria-label="Right"
                  >▶</button>
                </div>
                <button
                  type="button"
                  className="dpad-btn down"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('ArrowDown', 40, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('ArrowDown', 40, false); }}
                  onMouseDown={() => sendKey('ArrowDown', 40, true)}
                  onMouseUp={() => sendKey('ArrowDown', 40, false)}
                  aria-label="Down"
                >▼</button>
              </div>

              {/* Start & Select Capsule Buttons */}
              <div className="virtual-meta-buttons">
                <button
                  type="button"
                  className="meta-capsule-btn"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('Shift', 16, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('Shift', 16, false); }}
                  onMouseDown={() => sendKey('Shift', 16, true)}
                  onMouseUp={() => sendKey('Shift', 16, false)}
                >SELECT</button>
                <button
                  type="button"
                  className="meta-capsule-btn"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('Enter', 13, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('Enter', 13, false); }}
                  onMouseDown={() => sendKey('Enter', 13, true)}
                  onMouseUp={() => sendKey('Enter', 13, false)}
                >START</button>
              </div>


              {/* A & B Action Buttons */}
              <div className="virtual-actions">
                <button
                  type="button"
                  className="action-round-btn btn-a"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('x', 88, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('x', 88, false); }}
                  onMouseDown={() => sendKey('x', 88, true)}
                  onMouseUp={() => sendKey('x', 88, false)}
                  aria-label="A button"
                >
                  <span>A</span>
                  <small>Hit</small>
                </button>
                <button
                  type="button"
                  className="action-round-btn btn-b"
                  onTouchStart={(e) => { e.preventDefault(); sendKey('z', 90, true); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('z', 90, false); }}
                  onMouseDown={() => sendKey('z', 90, true)}
                  onMouseUp={() => sendKey('z', 90, false)}
                  aria-label="B button"
                >
                  <span>B</span>
                  <small>Ki</small>
                </button>
              </div>
            </div>
          </div>

        {/* Controls Guide Modal */}
        {showControlsHelp && (
          <div className="controls-modal-backdrop" onClick={() => setShowControlsHelp(false)}>
            <div className="controls-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Dragon Ball Z Controls Guide</h3>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => {
                    sound.playBack();
                    setShowControlsHelp(false);
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                <div className="controls-section">
                  <h4>💻 PC / Keyboard Controls</h4>
                  <table className="controls-table">
                    <tbody>
                      <tr><td><strong>Move / Jump / Duck</strong></td><td>Arrow Keys or W / A / S / D</td></tr>
                      <tr><td><strong>Light Attack / Ki Blast (B)</strong></td><td><kbd>Z</kbd> or <kbd>J</kbd></td></tr>
                      <tr><td><strong>Heavy Attack / Throw (A)</strong></td><td><kbd>X</kbd> or <kbd>K</kbd></td></tr>
                      <tr><td><strong>Charge Ki Energy (L)</strong></td><td><kbd>Q</kbd></td></tr>
                      <tr><td><strong>Super Dash / Flight (R)</strong></td><td><kbd>E</kbd></td></tr>
                      <tr><td><strong>Start Game / Pause</strong></td><td><kbd>Enter</kbd></td></tr>
                      <tr><td><strong>Select / Switch Fighter</strong></td><td><kbd>Shift</kbd> or <kbd>Space</kbd></td></tr>
                      <tr><td><strong>Speedup / Turbo Mode</strong></td><td><kbd>Tab</kbd></td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="controls-section">
                  <h4>📱 Mobile Virtual Touchscreen</h4>
                  <p>Touch the on-screen D-Pad and responsive A/B/L/R triggers with multi-touch and haptic vibration feedback.</p>
                </div>

                <div className="controls-section">
                  <h4>🎮 Bluetooth Gamepads (Xbox / PS / 8BitDo)</h4>
                  <p>Native Gamepad API is supported automatically. Connect your controller via Bluetooth or USB to play natively.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Offline Game Storage & Download Modal */}
        {showOfflineModal && (
          <div className="controls-modal-backdrop" onClick={() => setShowOfflineModal(false)}>
            <div className="controls-modal-card offline-dl-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Offline Game Storage</h3>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => {
                    sound.playBack();
                    setShowOfflineModal(false);
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                <div className={`offline-status-banner ${isCached ? 'cached' : 'pending'}`}>
                  <span className="material-symbols-outlined status-big-icon">
                    {isCached ? 'check_circle' : 'cloud_download'}
                  </span>
                  <div>
                    <h4>{isCached ? 'Ready for 100% Offline Play' : 'Offline Files Incomplete'}</h4>
                    <p>
                      {isCached
                        ? 'All 10 game engine files and Dragon Ball Z ROM (16 MB) are securely saved in your browser cache. The arcade will load instantly without any internet.'
                        : 'Download and cache the complete GBA engine and Dragon Ball Z game (16 MB) so you can play anywhere without an internet connection.'}
                    </p>
                  </div>
                </div>

                {isDownloadingCache ? (
                  <div className="offline-progress-wrap">
                    <div className="offline-progress-header">
                      <span>{cacheCurrentLabel}</span>
                      <strong>{cacheProgress}%</strong>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${cacheProgress}%` }} />
                    </div>
                    <span className="offline-progress-note">Saving files to browser cache... Please keep this page open.</span>
                  </div>
                ) : (
                  <div className="offline-actions-container">
                    {!isCached && (
                      <button
                        type="button"
                        className="offline-action-btn primary"
                        onClick={handleDownloadOfflineGame}
                      >
                        <span className="material-symbols-outlined">download</span>
                        <span>Download & Save for Offline (16 MB)</span>
                      </button>
                    )}

                    {isCached && (
                      <button
                        type="button"
                        className="offline-action-btn secondary"
                        onClick={handleDownloadOfflineGame}
                      >
                        <span className="material-symbols-outlined">refresh</span>
                        <span>Verify & Re-Download Cache</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="offline-action-btn tertiary"
                      onClick={downloadRomFile}
                    >
                      <span className="material-symbols-outlined">save_alt</span>
                      <span>Download GBA ROM File (.gba)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Embedded High-Performance Styles */}
      <style jsx>{`
        * { box-sizing: border-box; }

        .offline-page-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--bg-primary);
          background-image: radial-gradient(circle at 50% 8%, rgba(0, 102, 51, 0.08) 0%, transparent 60%);
          color: var(--text-primary);
          font-family: var(--font-sans, 'Inter', -apple-system, sans-serif);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 12px 32px;
          box-sizing: border-box;
          user-select: none;
          overflow-x: hidden;
          width: 100%;
          max-width: 100vw;
          animation: arcadePageFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes arcadePageFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Sleek Professional Arcade Navbar ── */
        .arcade-header {
          width: 100%;
          max-width: 960px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 999px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: var(--glass-shadow);
          margin-bottom: 14px;
        }

        .arcade-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .arcade-nav-btn.back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .arcade-nav-btn.back-btn:hover {
          background: var(--glass-bg-hover);
          border-color: var(--color-primary);
          color: var(--color-primary);
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(0, 102, 51, 0.12);
        }

        .arcade-brand-divider {
          width: 1px;
          height: 22px;
          background: var(--glass-border);
        }

        .arcade-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .arcade-brand-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .arcade-brand-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .arcade-brand-titles {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .arcade-title-row {
          display: flex;
          align-items: center;
          line-height: 1.1;
        }
        .brand-anime {
          font-size: 0.88rem;
          font-weight: 900;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }
        .brand-pakistan {
          font-size: 0.88rem;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-left: 3px;
        }
        .brand-pill-badge {
          font-size: 0.58rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 999px;
          background: var(--color-primary);
          color: #ffffff;
          margin-left: 6px;
          letter-spacing: 0.05em;
        }
        .arcade-subtitle {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
          line-height: 1;
          margin-top: 2px;
        }

        /* ── Center Status Group ── */
        .arcade-header-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
        }
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .status-dot.dot-green {
          background: #00cc66;
          box-shadow: 0 0 8px #00cc66;
          animation: pulse 1.6s infinite;
        }
        .status-dot.dot-amber {
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
          animation: pulse 1.6s infinite;
        }

        .cache-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--glass-border);
          transition: all 0.18s ease;
          background: var(--bg-secondary);
        }
        .cache-status-pill.cached {
          background: rgba(0, 102, 51, 0.1);
          border-color: rgba(0, 102, 51, 0.25);
          color: var(--color-primary);
        }
        .cache-status-pill.cached:hover {
          background: rgba(0, 102, 51, 0.18);
          transform: translateY(-1px);
        }
        .cache-status-pill.not-cached {
          background: rgba(2, 132, 199, 0.1);
          border-color: rgba(2, 132, 199, 0.25);
          color: #0284c7;
        }
        .cache-status-pill.not-cached:hover {
          background: rgba(2, 132, 199, 0.18);
          transform: translateY(-1px);
        }
        .status-pill-icon {
          font-size: 14px;
          line-height: 1;
        }

        /* ── Right Action Controls ── */
        .arcade-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.18s ease;
          font-size: 0.80rem;
          font-weight: 700;
        }
        .action-btn:hover {
          background: var(--glass-bg-hover);
          border-color: var(--color-primary);
          color: var(--color-primary);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 102, 51, 0.12);
        }
        .action-btn.muted {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.35);
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }

        .arcade-stage {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          overflow-x: hidden;
        }

        /* GBA Console Bezel */
        .gba-console-bezel {
          width: 100%;
          border-radius: 20px;
          background: linear-gradient(180deg, #091a0f 0%, #030d07 100%);
          border: 2px solid rgba(0, 229, 117, 0.3);
          box-shadow: var(--glass-shadow-hover), 0 24px 60px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .bezel-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px 8px;
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(0, 229, 117, 0.15);
        }

        .gba-power-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .power-led {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88;
        }
        .power-label {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.6);
        }

        .gba-metallic-logo {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gba-brand {
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: #00e575;
          text-shadow: 0 0 8px rgba(0, 229, 117, 0.4);
        }
        .gba-model {
          font-size: 0.82rem;
          font-weight: 800;
          color: #e2e8f0;
        }

        .bezel-top-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bezel-gfx-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #f1f5f9;
          font-size: 0.65rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .bezel-gfx-pill:hover {
          background: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .gba-speaker-grille {
          display: flex;
          gap: 4px;
        }
        .gba-speaker-grille span {
          width: 4px;
          height: 14px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.2);
        }

        /* ── Dynamic Bezel Ki Auras ── */
        .gba-console-bezel.bezel-aura-saiyan-hdr {
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 0 0 35px rgba(245, 158, 11, 0.25), 0 24px 60px rgba(0, 0, 0, 0.6);
        }
        .gba-console-bezel.bezel-aura-crisp-hd {
          border-color: rgba(0, 229, 117, 0.45);
          box-shadow: 0 0 35px rgba(0, 229, 117, 0.22), 0 24px 60px rgba(0, 0, 0, 0.6);
        }
        .gba-console-bezel.bezel-aura-retro-crt {
          border-color: rgba(56, 189, 248, 0.40);
          box-shadow: 0 0 35px rgba(56, 189, 248, 0.20), 0 24px 60px rgba(0, 0, 0, 0.6);
        }
        .gba-console-bezel.bezel-aura-classic {
          border-color: rgba(167, 139, 250, 0.35);
          box-shadow: 0 0 30px rgba(167, 139, 250, 0.18), 0 24px 60px rgba(0, 0, 0, 0.6);
        }

        /* Screen Viewport */
        .gba-screen-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 2;
          height: auto;
          min-height: 220px;
          max-height: 520px;
          background: #000000;
          overflow: hidden;
        }

        .gba-canvas-target {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gba-canvas-target :global(canvas),
        .gba-canvas-target :global(iframe) {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
        }

        /* ── Graphics Enhancement Filters ── */
        /* 1. Super Saiyan HDR (Vibrant Anime Colors & Specular Glow) */
        .gfx-mode-saiyan-hdr .gba-canvas-target :global(canvas) {
          filter: contrast(1.18) saturate(1.42) brightness(1.05) drop-shadow(0 0 10px rgba(245, 158, 11, 0.2));
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          transition: filter 0.25s ease;
        }

        /* 2. Crisp HD Smooth (Anti-Aliased Sprites) */
        .gfx-mode-crisp-hd .gba-canvas-target :global(canvas) {
          filter: contrast(1.07) saturate(1.18) brightness(1.02);
          image-rendering: auto;
          transition: filter 0.25s ease;
        }

        /* 3. Retro Arcade CRT (Scanlines & Phosphor Glow) */
        .gfx-mode-retro-crt .gba-canvas-target :global(canvas) {
          filter: contrast(1.14) saturate(1.24) brightness(1.06);
          image-rendering: pixelated;
          transition: filter 0.25s ease;
        }

        /* 4. Classic Original (Pure 2004 GBA Hardware Pixels) */
        .gfx-mode-classic .gba-canvas-target :global(canvas) {
          filter: none;
          image-rendering: pixelated;
          transition: filter 0.25s ease;
        }

        /* Retro CRT Scanline Shader Overlay */
        .crt-scanline-shader {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.32) 50%
          ), linear-gradient(
            90deg,
            rgba(255, 0, 0, 0.03),
            rgba(0, 255, 0, 0.015),
            rgba(0, 0, 255, 0.03)
          );
          background-size: 100% 3px, 6px 100%;
          box-shadow: inset 0 0 45px rgba(0, 0, 0, 0.75);
          z-index: 5;
        }

        /* Super Saiyan Ki Aura VFX Glow */
        .saiyan-aura-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 50px rgba(251, 191, 36, 0.24);
          mix-blend-mode: screen;
          z-index: 5;
          animation: saiyanAuraPulse 3s ease-in-out infinite;
        }

        @keyframes saiyanAuraPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        /* HUD Mode Toast */
        .gfx-hud-pill {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 18px;
          border-radius: 999px;
          background: rgba(4, 14, 9, 0.92);
          border: 1px solid rgba(245, 158, 11, 0.55);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(245, 158, 11, 0.3);
          z-index: 25;
          pointer-events: none;
          animation: hudPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes hudPop {
          from { opacity: 0; transform: translate(-50%, -10px) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        .gfx-bezel-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(0, 229, 117, 0.12);
          border: 1px solid rgba(0, 229, 117, 0.3);
          color: #00e575;
          font-size: 0.68rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .gfx-bezel-badge:hover {
          background: rgba(0, 229, 117, 0.22);
          transform: scale(1.03);
        }

        .screen-loading-overlay, .screen-error-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          background: #010603;
          z-index: 10;
        }

        .loading-monogram {
          position: relative;
          display: grid;
          place-items: center;
          margin-bottom: 16px;
        }

        .dragon-ball-badge {
          font-size: 1.5rem;
          font-weight: 900;
          color: #fbbf24;
          text-shadow: 0 0 16px #f59e0b;
        }

        .loading-spinner {
          position: absolute;
          width: 72px;
          height: 72px;
          border: 3px solid rgba(0, 229, 117, 0.2);
          border-top-color: #00ff88;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .screen-loading-overlay h3 {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          color: #f0fdf4;
        }
        .screen-loading-overlay p {
          margin: 0 0 10px 0;
          font-size: 0.85rem;
          color: #86efac;
        }
        .cache-note {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          background: rgba(0, 229, 117, 0.12);
          color: #00e575;
          border: 1px solid rgba(0, 229, 117, 0.3);
        }

        .retry-btn {
          margin-top: 12px;
          padding: 8px 18px;
          border-radius: 999px;
          background: #00994d;
          border: 0;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .bezel-bottom-bar {
          padding: 8px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(0, 229, 117, 0.15);
        }

        .game-label {
          font-size: 0.70rem;
          font-weight: 800;
          color: #86efac;
          letter-spacing: 0.05em;
        }

        .bezel-shortcuts {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .shortcut-pill {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
        }

        /* ═══════════════════════════════════════════════
           MOBILE TOUCH GAMEPAD — fully responsive
        ═══════════════════════════════════════════════ */
        .mobile-touch-gamepad {
          width: 100%;
          display: none;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
          padding: 14px 10px;
          background: rgba(4, 14, 9, 0.70);
          border: 1px solid rgba(0, 229, 117, 0.18);
          border-radius: 20px;
          backdrop-filter: blur(16px);
        }

        @media (max-width: 820px) {
          .mobile-touch-gamepad {
            display: flex;
          }
        }

        /* L / R shoulder row */
        .gamepad-shoulders-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .shoulder-trigger-btn {
          flex: 1;
          min-width: 0;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(180deg, #1f3627 0%, #0d1e13 100%);
          border: 1.5px solid rgba(0, 229, 117, 0.35);
          box-shadow: 0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
          color: #f0fdf4;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          display: grid;
          place-items: center;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.08s, transform 0.08s;
        }
        .shoulder-trigger-btn:active {
          background: #00e575;
          color: #000;
          transform: scale(0.96);
        }

        /* Main gamepad row */
        .gamepad-main-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
        }

        /* ── D-Pad ── */
        .virtual-dpad {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
        }
        .dpad-horizontal {
          display: flex;
          align-items: center;
        }
        .dpad-btn {
          width: 46px;
          height: 46px;
          background: linear-gradient(145deg, #1c2e22 0%, #0c1810 100%);
          border: 1.5px solid rgba(0, 229, 117, 0.28);
          color: #a3e8c8;
          font-size: 0.85rem;
          display: grid;
          place-items: center;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), 0 3px 6px rgba(0,0,0,0.4);
          transition: background 0.08s;
        }
        .dpad-btn:active { background: #00e575; color: #000; }
        .dpad-btn.up    { border-radius: 10px 10px 0 0; }
        .dpad-btn.down  { border-radius: 0 0 10px 10px; }
        .dpad-btn.left  { border-radius: 10px 0 0 10px; }
        .dpad-btn.right { border-radius: 0 10px 10px 0; }
        .dpad-center {
          width: 46px; height: 46px;
          background: #0e1d13;
          border: 1px solid rgba(0, 229, 117, 0.12);
        }

        /* ── Center meta (SELECT / START) ── */
        .virtual-meta-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }
        .meta-capsule-btn {
          width: 64px;
          height: 22px;
          border-radius: 999px;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.2);
          color: #cbd5e1;
          font-size: 0.58rem;
          font-weight: 800;
          cursor: pointer;
          display: grid;
          place-items: center;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.08s;
          letter-spacing: 0.05em;
        }
        .meta-capsule-btn:active { background: #00e575; color: #000; }

        /* ── A / B action buttons ── */
        .virtual-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .action-round-btn {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.22);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          box-shadow: 0 6px 14px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.25);
          transition: transform 0.08s;
        }
        .action-round-btn span { font-size: 1.05rem; font-weight: 900; line-height: 1; }
        .action-round-btn small { font-size: 0.5rem; font-weight: 800; text-transform: uppercase; opacity: 0.8; }
        .action-round-btn.btn-b { background: linear-gradient(145deg, #10b981 0%, #047857 100%); color: #fff; }
        .action-round-btn.btn-a { background: linear-gradient(145deg, #059669 0%, #064e3b 100%); color: #fff; }
        .action-round-btn:active { background: #00ff88 !important; color: #000 !important; transform: scale(0.92); }

        /* Controls Modal */
        .controls-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 99999;
          display: grid;
          place-items: center;
          padding: 16px;
        }

        .controls-modal-card {
          width: 100%;
          max-width: 520px;
          background: var(--bg-secondary);
          border: 1.5px solid var(--glass-border);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
          color: var(--text-primary);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 800;
          color: var(--color-primary);
        }
        .close-modal-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          cursor: pointer;
          display: grid;
          place-items: center;
          font-weight: 700;
          transition: all 0.16s ease;
        }
        .close-modal-btn:hover {
          background: var(--glass-bg-hover);
          color: var(--color-primary);
        }

        .controls-section {
          margin-bottom: 16px;
        }
        .controls-section h4 {
          margin: 0 0 8px 0;
          font-size: 0.92rem;
          font-weight: 800;
          color: var(--color-primary);
        }
        .controls-section p {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .controls-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .controls-table td {
          padding: 7px 4px;
          border-bottom: 1px solid var(--glass-border);
          color: var(--text-secondary);
        }
        .controls-table td strong {
          color: var(--text-primary);
        }
        kbd {
          padding: 2px 7px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          border: 1px solid var(--glass-border);
          color: var(--color-primary);
          font-family: monospace;
          font-weight: 700;
          font-size: 0.80rem;
        }

        /* Offline Modal Enhancements */
        .offline-dl-card {
          max-width: 480px;
        }
        .offline-status-banner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          margin-bottom: 16px;
        }
        .offline-status-banner.cached {
          background: rgba(0, 102, 51, 0.12);
          border: 1px solid rgba(0, 102, 51, 0.3);
        }
        .offline-status-banner.pending {
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .status-big-icon {
          font-size: 32px;
          color: var(--color-primary);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .offline-status-banner.pending .status-big-icon {
          color: #0284c7;
        }
        .offline-status-banner h4 {
          margin: 0 0 4px 0;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .offline-status-banner p {
          margin: 0;
          font-size: 0.80rem;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .offline-progress-wrap {
          padding: 14px 0 6px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .offline-progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-primary);
        }
        .progress-bar-track {
          width: 100%;
          height: 6px;
          border-radius: 99px;
          background: var(--bg-tertiary);
          border: 1px solid var(--glass-border);
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
          transition: width 0.3s ease;
        }
        .offline-progress-note {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .offline-actions-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .offline-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 14px;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
          border: none;
          font-family: inherit;
        }
        .offline-action-btn.primary {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 102, 51, 0.35);
        }
        .offline-action-btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 102, 51, 0.45);
        }
        .offline-action-btn.secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--glass-border);
        }
        .offline-action-btn.secondary:hover {
          background: var(--glass-bg-hover);
          border-color: var(--color-primary);
        }
        .offline-action-btn.tertiary {
          background: transparent;
          color: var(--color-primary);
          border: 1px solid var(--glass-border);
        }
        .offline-action-btn.tertiary:hover {
          background: var(--bg-tertiary);
        }

        /* ── Bulletproof Responsive Rules: Prevents Any Cutting or Overflow ── */
        .arcade-header-right {
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .arcade-header {
            padding: 6px 8px;
            gap: 6px;
            margin-bottom: 10px;
          }
          .arcade-subtitle {
            display: none;
          }
          .btn-label-desktop, .back-btn-text {
            display: none;
          }
          .arcade-brand-divider {
            display: none;
          }
          .status-text {
            display: none;
          }
          .cache-pill-label {
            display: none;
          }
          .status-pill {
            padding: 5px 8px;
          }
          .cache-status-pill {
            padding: 5px 8px;
          }
          .action-btn {
            padding: 0;
            width: 32px;
            height: 32px;
            min-width: 32px;
            justify-content: center;
          }
          .arcade-nav-btn.back-btn {
            padding: 0;
            width: 32px;
            height: 32px;
            min-width: 32px;
            justify-content: center;
          }
          .arcade-header-right {
            gap: 4px;
          }
        }

        /* On screens under 600px: hide 'PAKISTAN' text to keep logo + ANIME + ARCADE compact */
        @media (max-width: 600px) {
          .brand-pakistan {
            display: none;
          }
          .arcade-brand {
            gap: 6px;
          }
          .arcade-brand-icon {
            width: 24px;
            height: 24px;
          }
          .brand-anime {
            font-size: 0.82rem;
          }
          .brand-pill-badge {
            font-size: 0.52rem;
            padding: 1px 5px;
            margin-left: 4px;
          }
        }

        /* On mobile screens under 480px: hide redundant center pills so action buttons never cut off */
        @media (max-width: 480px) {
          .arcade-header-center {
            display: none;
          }
          .arcade-header {
            padding: 5px 8px;
            justify-content: space-between;
          }
          .action-btn {
            width: 30px;
            height: 30px;
            min-width: 30px;
          }
          .arcade-nav-btn.back-btn {
            width: 30px;
            height: 30px;
            min-width: 30px;
          }
          .action-btn .material-symbols-outlined,
          .arcade-nav-btn.back-btn .material-symbols-outlined {
            font-size: 18px;
          }
        }

        @media (max-width: 400px) {
          .bezel-shortcuts { display: none; }
          .bezel-top-bar { padding: 6px 10px; }
          .gba-brand, .gba-model { font-size: 0.68rem; }
          .dpad-btn { width: 40px; height: 40px; font-size: 0.75rem; }
          .dpad-center { width: 40px; height: 40px; }
          .action-round-btn { width: 48px; height: 48px; }
          .shoulder-trigger-btn { font-size: 0.65rem; }
          .meta-capsule-btn { width: 56px; }
        }
      `}</style>
    </div>
  );
}
