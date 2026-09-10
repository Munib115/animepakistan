'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflineArcadePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [emulatorLoaded, setEmulatorLoaded] = useState(false);
  const [emulatorError, setEmulatorError] = useState<string | null>(null);
  const arcadeContainerRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLDivElement>(null);
  const ejsScriptRef = useRef<HTMLScriptElement | null>(null);

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
        (window as any).EJS_VirtualGamepadSettings = [0];
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

    const timer = setTimeout(startEmulator, 150);

    // Cleanup: stop emulator when component unmounts (e.g. navigating away)
    return () => {
      clearTimeout(timer);
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

  // EmulatorJS key code mapping (GBA default mapping)
  // key = display key name, code = KeyboardEvent.code value, keyCode = legacy code
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

    const makeEvent = () => new KeyboardEvent(eventType, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });

    // 1. Dispatch on the emulator canvas element (most reliable for EmulatorJS)
    const canvas = document.getElementById('gba-game-canvas');
    if (canvas) canvas.dispatchEvent(makeEvent());

    // 2. Dispatch on document (EmulatorJS listens here)
    document.dispatchEvent(makeEvent());

    // 3. Dispatch on window as fallback
    window.dispatchEvent(makeEvent());

    // 4. Use EmulatorJS gamepad API directly if available
    const ejs = (window as any).EJS_emulator;
    if (ejs && ejs.gameManager && ejs.gameManager.input) {
      try {
        ejs.gameManager.input.emit(eventType, { key, code, keyCode });
      } catch {}
    }
  }, []);

  return (
    <div className="offline-page-root" ref={arcadeContainerRef}>
      {/* Top Floating Status Bar */}
        <header className="arcade-header">
          {/* Back button — stops emulator before navigating */}
          <button
            type="button"
            className="arcade-back-btn"
            aria-label="Go back"
            onClick={() => { stopEmulator(); router.push('/'); }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

        <div className="arcade-badge-group">
          {isOnline ? (
            <div className="status-badge online">
              <span className="pulse-dot green" />
              <span>Online</span>
            </div>
          ) : (
            <div className="status-badge offline">
              <span className="pulse-dot orange" />
              <span>Offline</span>
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
                onTouchStart={(e) => { e.preventDefault(); sendKey('a', 65, true); }}
                onTouchEnd={(e) => { e.preventDefault(); sendKey('a', 65, false); }}
                onMouseDown={() => sendKey('a', 65, true)}
                onMouseUp={() => sendKey('a', 65, false)}
              >
                <span>L · Charge Ki</span>
              </button>

              <button
                type="button"
                className="shoulder-trigger-btn right"
                onTouchStart={(e) => { e.preventDefault(); sendKey('s', 83, true); }}
                onTouchEnd={(e) => { e.preventDefault(); sendKey('s', 83, false); }}
                onMouseDown={() => sendKey('s', 83, true)}
                onMouseUp={() => sendKey('s', 83, false)}
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
        * { box-sizing: border-box; }

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
          padding: 12px 10px 28px;
          box-sizing: border-box;
          user-select: none;
          overflow-x: hidden;
          width: 100%;
          max-width: 100vw;
        }

        .arcade-header {
          width: 100%;
          max-width: 960px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(4, 20, 10, 0.7);
          border: 1px solid rgba(0, 229, 117, 0.22);
          backdrop-filter: blur(16px);
          margin-bottom: 10px;
          overflow: hidden;
        }

        .arcade-back-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          color: #f0fdf4;
          text-decoration: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          transition: all 0.18s;
        }
        .arcade-back-btn:hover {
          background: rgba(0, 229, 117, 0.2);
          border-color: #00e575;
        }

        .arcade-badge-group {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
          justify-content: center;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.70rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
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
          overflow-x: hidden;
        }

        /* GBA Console Bezel */
        .gba-console-bezel {
          width: 100%;
          border-radius: 20px;
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

        /* ═══════════════════════════════════════════════
           MOBILE TOUCH GAMEPAD — fully responsive
        ═══════════════════════════════════════════════ */
        .mobile-touch-gamepad {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
          padding: 14px 10px;
          background: rgba(4, 14, 9, 0.70);
          border: 1px solid rgba(0, 229, 117, 0.18);
          border-radius: 20px;
          backdrop-filter: blur(16px);
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
