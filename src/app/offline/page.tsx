'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

export default function OfflineArcadePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [emulatorLoaded, setEmulatorLoaded] = useState(false);
  const [emulatorError, setEmulatorError] = useState<string | null>(null);
  const arcadeContainerRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLDivElement>(null);

  // Connectivity monitoring
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 820 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Initialize self-hosted EmulatorJS
  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;

    const startEmulator = () => {
      try {
        // Configure EmulatorJS globals
        (window as any).EJS_player = '#gba-game-canvas';
        (window as any).EJS_core = 'gba';
        (window as any).EJS_gameUrl = '/roms/dbz-supersonic-warriors.zip';
        (window as any).EJS_pathtodata = '/emulatorjs/';
        (window as any).EJS_gameName = 'Dragon Ball Z: Supersonic Warriors';
        (window as any).EJS_color = '#00e575';
        (window as any).EJS_startOnLoaded = true;
        (window as any).EJS_volume = isMuted ? 0 : 0.9;
        (window as any).EJS_alignStartButton = 'center';
        (window as any).EJS_noAutoFocus = false;
        
        // Disable external analytics or ads
        (window as any).EJS_disableDatabases = false;
        (window as any).EJS_VirtualGamepadSettings = [
          0, // Disable default emulatorjs virtual gamepad since we provide a custom responsive arcade controller
        ];

        (window as any).EJS_onGameStart = () => {
          setEmulatorLoaded(true);
        };

        // Inject self-hosted loader.js
        scriptElement = document.createElement('script');
        scriptElement.src = '/emulatorjs/loader.js';
        scriptElement.async = true;
        scriptElement.onload = () => {
          setEmulatorLoaded(true);
        };
        scriptElement.onerror = () => {
          setEmulatorError('Could not load local GBA emulator engine. Please ensure files are cached.');
        };

        document.body.appendChild(scriptElement);
      } catch (err: any) {
        setEmulatorError(err?.message || 'Failed to initialize emulator');
      }
    };

    // Slight delay to ensure DOM mount
    const timer = setTimeout(startEmulator, 150);

    return () => {
      clearTimeout(timer);
      if (scriptElement && scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
    };
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

  // Simulate Key Event for Gamepad Buttons
  const sendKey = useCallback((key: string, keyCode: number, isDown: boolean) => {
    triggerHaptic();
    const eventType = isDown ? 'keydown' : 'keyup';
    const event = new KeyboardEvent(eventType, {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }, []);

  return (
    <div className="offline-page-root" ref={arcadeContainerRef}>
      {/* Top Floating Status Bar */}
      <header className="arcade-header">
        <Link href="/" className="arcade-back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
          <span>{isOnline ? 'Back to Anime' : 'Exit to App'}</span>
        </Link>

        <div className="arcade-badge-group">
          {isOnline ? (
            <div className="status-badge online">
              <span className="pulse-dot green" />
              <span>Internet Connected! Tap to stream</span>
            </div>
          ) : (
            <div className="status-badge offline">
              <span className="pulse-dot orange" />
              <span>Offline Mode • Zero Data Used</span>
            </div>
          )}
        </div>

        <div className="arcade-top-actions">
          <button
            type="button"
            className="action-icon-btn"
            onClick={() => setShowControlsHelp(!showControlsHelp)}
            title="Controls Guide"
            aria-label="Controls Guide"
          >
            <span className="material-symbols-outlined">sports_esports</span>
          </button>
          <button
            type="button"
            className="action-icon-btn"
            onClick={toggleFullscreen}
            title="Fullscreen"
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
        <div className="gba-console-bezel" ref={gameFrameRef}>
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
            <div className="gba-speaker-grille">
              <span /><span /><span />
            </div>
          </div>

          {/* Screen Display Bezel */}
          <div className="gba-screen-viewport">
            <div id="gba-game-canvas" className="gba-canvas-target" />

            {/* Loading / Ready state */}
            {!emulatorLoaded && !emulatorError && (
              <div className="screen-loading-overlay">
                <div className="loading-monogram">
                  <span className="dragon-ball-badge">DBZ</span>
                  <div className="loading-spinner" />
                </div>
                <h3>Dragon Ball Z: Supersonic Warriors</h3>
                <p>Loading self-hosted WebAssembly GBA core...</p>
                <span className="cache-note">Works 100% Offline • No Internet Required</span>
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
              <span className="shortcut-pill">Z: Attack</span>
              <span className="shortcut-pill">X: Heavy</span>
              <span className="shortcut-pill">A: Charge Ki</span>
              <span className="shortcut-pill">S: Super Dash</span>
              <span className="shortcut-pill">Enter: Start</span>
            </div>
          </div>
        </div>

        {/* Mobile Tactile Virtual Gamepad (Visible on mobile/touch screens) */}
        {isMobile && (
          <div className="mobile-touch-gamepad">
            {/* L & R Shoulder Triggers */}
            <div className="gamepad-shoulders-row">
              <button
                type="button"
                className="shoulder-trigger-btn left"
                onTouchStart={() => sendKey('a', 65, true)}
                onTouchEnd={() => sendKey('a', 65, false)}
                onMouseDown={() => sendKey('a', 65, true)}
                onMouseUp={() => sendKey('a', 65, false)}
              >
                <span>L (Charge Ki)</span>
              </button>

              <button
                type="button"
                className="shoulder-trigger-btn right"
                onTouchStart={() => sendKey('s', 83, true)}
                onTouchEnd={() => sendKey('s', 83, false)}
                onMouseDown={() => sendKey('s', 83, true)}
                onMouseUp={() => sendKey('s', 83, false)}
              >
                <span>R (Super Dash)</span>
              </button>
            </div>

            {/* Lower Row: D-Pad, Start/Select, Action Buttons */}
            <div className="gamepad-main-row">
              {/* Directional D-Pad */}
              <div className="virtual-dpad">
                <button
                  type="button"
                  className="dpad-btn up"
                  onTouchStart={() => sendKey('ArrowUp', 38, true)}
                  onTouchEnd={() => sendKey('ArrowUp', 38, false)}
                  aria-label="Up"
                >
                  ▲
                </button>
                <div className="dpad-horizontal">
                  <button
                    type="button"
                    className="dpad-btn left"
                    onTouchStart={() => sendKey('ArrowLeft', 37, true)}
                    onTouchEnd={() => sendKey('ArrowLeft', 37, false)}
                    aria-label="Left"
                  >
                    ◀
                  </button>
                  <div className="dpad-center" />
                  <button
                    type="button"
                    className="dpad-btn right"
                    onTouchStart={() => sendKey('ArrowRight', 39, true)}
                    onTouchEnd={() => sendKey('ArrowRight', 39, false)}
                    aria-label="Right"
                  >
                    ▶
                  </button>
                </div>
                <button
                  type="button"
                  className="dpad-btn down"
                  onTouchStart={() => sendKey('ArrowDown', 40, true)}
                  onTouchEnd={() => sendKey('ArrowDown', 40, false)}
                  aria-label="Down"
                >
                  ▼
                </button>
              </div>

              {/* Start & Select Capsule Buttons */}
              <div className="virtual-meta-buttons">
                <button
                  type="button"
                  className="meta-capsule-btn"
                  onTouchStart={() => sendKey('Shift', 16, true)}
                  onTouchEnd={() => sendKey('Shift', 16, false)}
                >
                  <span>SELECT</span>
                </button>
                <button
                  type="button"
                  className="meta-capsule-btn"
                  onTouchStart={() => sendKey('Enter', 13, true)}
                  onTouchEnd={() => sendKey('Enter', 13, false)}
                >
                  <span>START</span>
                </button>
              </div>

              {/* A & B Action Buttons (Angled GBA style) */}
              <div className="virtual-actions">
                <button
                  type="button"
                  className="action-round-btn btn-b"
                  onTouchStart={() => sendKey('z', 90, true)}
                  onTouchEnd={() => sendKey('z', 90, false)}
                >
                  <span>B</span>
                  <small>Ki</small>
                </button>
                <button
                  type="button"
                  className="action-round-btn btn-a"
                  onTouchStart={() => sendKey('x', 88, true)}
                  onTouchEnd={() => sendKey('x', 88, false)}
                >
                  <span>A</span>
                  <small>Hit</small>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls Guide Modal */}
        {showControlsHelp && (
          <div className="controls-modal-backdrop" onClick={() => setShowControlsHelp(false)}>
            <div className="controls-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Dragon Ball Z Controls Guide</h3>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowControlsHelp(false)}
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
                      <tr><td><strong>Charge Ki Energy (L)</strong></td><td><kbd>A</kbd> or <kbd>Q</kbd></td></tr>
                      <tr><td><strong>Super Dash / Flight (R)</strong></td><td><kbd>S</kbd> or <kbd>E</kbd></td></tr>
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
      </main>

      {/* Embedded High-Performance Styles */}
      <style jsx>{`
        .offline-page-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: #020904;
          background: radial-gradient(circle at 50% 15%, #05210e 0%, #020c05 60%, #000000 100%);
          color: #f0fdf4;
          font-family: 'Inter', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 14px 28px;
          box-sizing: border-box;
          user-select: none;
        }

        .arcade-header {
          width: 100%;
          max-width: 960px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(4, 20, 10, 0.7);
          border: 1px solid rgba(0, 229, 117, 0.22);
          backdrop-filter: blur(16px);
          margin-bottom: 12px;
          box-sizing: border-box;
        }

        .arcade-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #f0fdf4;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          transition: all 0.18s;
        }
        .arcade-back-btn:hover {
          background: rgba(0, 229, 117, 0.2);
          border-color: #00e575;
          transform: translateX(-2px);
        }

        .arcade-badge-group {
          display: flex;
          align-items: center;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .status-badge.offline {
          background: rgba(234, 179, 8, 0.14);
          border: 1px solid rgba(234, 179, 8, 0.35);
          color: #facc15;
        }
        .status-badge.online {
          background: rgba(0, 229, 117, 0.16);
          border: 1px solid rgba(0, 229, 117, 0.4);
          color: #00ff88;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        .pulse-dot.orange { background: #facc15; box-shadow: 0 0 8px #facc15; }
        .pulse-dot.green { background: #00ff88; box-shadow: 0 0 8px #00ff88; }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }

        .arcade-top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f0fdf4;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.16s;
        }
        .action-icon-btn:hover {
          background: rgba(0, 229, 117, 0.25);
          border-color: #00e575;
          transform: translateY(-2px);
        }

        .arcade-stage {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
        }

        /* GBA Console Bezel */
        .gba-console-bezel {
          width: 100%;
          max-width: 820px;
          border-radius: 28px;
          background: linear-gradient(180deg, #091a0f 0%, #030d07 100%);
          border: 2px solid rgba(0, 229, 117, 0.3);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 204, 102, 0.15);
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

        /* Screen Viewport */
        .gba-screen-viewport {
          position: relative;
          width: 100%;
          height: 0;
          padding-bottom: 66.66%; /* Classic 3:2 GBA Aspect Ratio (240x160) */
          background: #000000;
          overflow: hidden;
        }

        .gba-canvas-target {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #000;
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

        /* Mobile Touch Gamepad */
        .mobile-touch-gamepad {
          width: 100%;
          max-width: 820px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 14px;
          padding: 0 4px;
          box-sizing: border-box;
        }

        .gamepad-shoulders-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .shoulder-trigger-btn {
          flex: 1;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(180deg, #1f3627 0%, #0d1e13 100%);
          border: 1.5px solid rgba(0, 229, 117, 0.35);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2);
          color: #f0fdf4;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          display: grid;
          place-items: center;
          touch-action: manipulation;
        }
        .shoulder-trigger-btn:active {
          background: #00e575;
          color: #000;
          transform: translateY(2px);
        }

        .gamepad-main-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        /* Virtual D-Pad */
        .virtual-dpad {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .dpad-horizontal {
          display: flex;
          align-items: center;
        }

        .dpad-btn {
          width: 48px;
          height: 48px;
          background: linear-gradient(145deg, #1c2e22 0%, #0c1810 100%);
          border: 1px solid rgba(0, 229, 117, 0.3);
          color: #94a3b8;
          font-size: 1rem;
          display: grid;
          place-items: center;
          cursor: pointer;
          touch-action: manipulation;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15);
        }
        .dpad-btn:active {
          background: #00e575;
          color: #000;
        }

        .dpad-btn.up { border-radius: 10px 10px 0 0; }
        .dpad-btn.down { border-radius: 0 0 10px 10px; }
        .dpad-btn.left { border-radius: 10px 0 0 10px; }
        .dpad-btn.right { border-radius: 0 10px 10px 0; }
        .dpad-center {
          width: 48px;
          height: 48px;
          background: #0e1d13;
          border: 1px solid rgba(0, 229, 117, 0.15);
        }

        /* Virtual Meta (Select/Start) */
        .virtual-meta-buttons {
          display: flex;
          gap: 10px;
          transform: rotate(-18deg);
          margin-top: 20px;
        }

        .meta-capsule-btn {
          width: 58px;
          height: 24px;
          border-radius: 999px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #cbd5e1;
          font-size: 0.60rem;
          font-weight: 800;
          cursor: pointer;
          display: grid;
          place-items: center;
          touch-action: manipulation;
        }
        .meta-capsule-btn:active {
          background: #00e575;
          color: #000;
        }

        /* Virtual Actions (A & B) */
        .virtual-actions {
          display: flex;
          gap: 14px;
          transform: rotate(-24deg);
        }

        .action-round-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.25);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          touch-action: manipulation;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.3);
        }
        .action-round-btn span {
          font-size: 1.15rem;
          font-weight: 900;
          line-height: 1;
        }
        .action-round-btn small {
          font-size: 0.55rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .action-round-btn.btn-b {
          background: linear-gradient(145deg, #10b981 0%, #047857 100%);
          color: #fff;
        }
        .action-round-btn.btn-a {
          background: linear-gradient(145deg, #059669 0%, #064e3b 100%);
          color: #fff;
          margin-top: -16px;
        }
        .action-round-btn:active {
          background: #00ff88 !important;
          color: #000 !important;
          transform: scale(0.95);
        }

        /* Controls Modal */
        .controls-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(12px);
          z-index: 99999;
          display: grid;
          place-items: center;
          padding: 16px;
        }

        .controls-modal-card {
          width: 100%;
          max-width: 520px;
          background: #08160c;
          border: 1.5px solid rgba(0, 229, 117, 0.35);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #00ff88;
        }
        .close-modal-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 0;
          color: #fff;
          cursor: pointer;
        }

        .controls-section {
          margin-bottom: 16px;
        }
        .controls-section h4 {
          margin: 0 0 8px 0;
          font-size: 0.92rem;
          color: #f0fdf4;
        }
        .controls-section p {
          margin: 0;
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        .controls-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .controls-table td {
          padding: 6px 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        kbd {
          padding: 2px 6px;
          border-radius: 4px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #00ff88;
          font-family: monospace;
          font-weight: 700;
        }

        @media (max-width: 540px) {
          .bezel-shortcuts { display: none; }
          .bezel-top-bar { padding: 8px 12px; }
          .gba-brand { font-size: 0.74rem; }
          .gba-model { font-size: 0.74rem; }
          .dpad-btn { width: 42px; height: 42px; }
          .dpad-center { width: 42px; height: 42px; }
          .action-round-btn { width: 52px; height: 52px; }
        }
      `}</style>
    </div>
  );
}
