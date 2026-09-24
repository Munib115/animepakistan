'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

interface NativeHlsPlayerProps {
  streamUrl: string;
  title?: string;
  poster?: string;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
}

export default function NativeHlsPlayer({
  streamUrl,
  title,
  poster,
  onError,
  onTimeUpdate,
  initialTime = 0,
}: NativeHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [qualities, setQualities] = useState<{ id: number; height: number; name: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [doubleClickFeedback, setDoubleClickFeedback] = useState<'left' | 'right' | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }
    }, 3200);
  }, [isPlaying]);

  // Initialize HLS Stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setIsBuffering(true);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        if (data.levels && data.levels.length > 0) {
          const mappedQualities = data.levels.map((level, idx) => ({
            id: idx,
            height: level.height,
            name: level.height ? `${level.height}p` : `Level ${idx + 1}`,
          }));
          setQualities(mappedQualities);
        }

        if (initialTime > 0) {
          video.currentTime = initialTime;
        }

        video.play().then(() => setIsPlaying(true)).catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_, err) => {
        if (err.fatal) {
          console.warn('[NativeHlsPlayer] HLS fatal error, falling back:', err.details);
          switch (err.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (onError) onError();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        if (onError) onError();
      });
    } else {
      if (onError) onError();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, onError, initialTime]);

  // Video event listeners
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }

    if (onTimeUpdate) {
      onTimeUpdate(video.currentTime, video.duration || 0);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration || video.duration, video.currentTime + seconds));
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 0.8;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
        resetControlsTimer();
      } else if (e.code === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleSkip(-10);
        resetControlsTimer();
      } else if (e.code === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleSkip(10);
        resetControlsTimer();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.1));
        resetControlsTimer();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.1));
        resetControlsTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isMuted, togglePlay, toggleFullscreen]);

  // Double-tap feedback for mobile/desktop
  const handleDoubleClickArea = (side: 'left' | 'right') => {
    if (side === 'left') {
      handleSkip(-10);
      setDoubleClickFeedback('left');
    } else {
      handleSkip(10);
      setDoubleClickFeedback('right');
    }
    setTimeout(() => setDoubleClickFeedback(null), 600);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSpeedSelect = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const handleQualitySelect = (qualityId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityId;
      setCurrentQuality(qualityId);
      setShowQualityMenu(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000000',
          cursor: showControls ? 'pointer' : 'none',
        }}
      />

      {/* Double click seek zones */}
      <div
        onDoubleClick={() => handleDoubleClickArea('left')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '35%',
          height: '100%',
          zIndex: 4,
          pointerEvents: 'auto',
        }}
      />
      <div
        onDoubleClick={() => handleDoubleClickArea('right')}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '35%',
          height: '100%',
          zIndex: 4,
          pointerEvents: 'auto',
        }}
      />

      {/* Double tap ripple indicators */}
      {doubleClickFeedback === 'left' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '20%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.65)',
          color: '#00ff66',
          padding: '12px 20px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          animation: 'pulse 0.4s ease',
        }}>
          <span className="material-symbols-outlined">replay_10</span>
          <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>-10s</span>
        </div>
      )}
      {doubleClickFeedback === 'right' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          right: '20%',
          transform: 'translate(50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.65)',
          color: '#00ff66',
          padding: '12px 20px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          animation: 'pulse 0.4s ease',
        }}>
          <span className="material-symbols-outlined">forward_10</span>
          <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>+10s</span>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 5,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            border: '4px solid rgba(0, 255, 102, 0.2)',
            borderTopColor: '#00ff66',
            animation: 'spin-loader 0.8s linear infinite',
            boxShadow: '0 0 16px rgba(0, 255, 102, 0.4)',
          }} />
        </div>
      )}

      {/* Big Center Play Button when paused */}
      {!isPlaying && !isBuffering && (
        <div
          onClick={togglePlay}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 255, 102, 0.95)',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 6,
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.6)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '38px', marginLeft: '4px' }}>
            play_arrow
          </span>
        </div>
      )}

      {/* Controls Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        padding: '16px 20px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 8,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transform: showControls ? 'translateY(0)' : 'translateY(10px)',
      }}>
        {/* Progress Bar */}
        <div
          onClick={handleSeek}
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '999px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Buffered progress */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${duration ? (bufferedEnd / duration) * 100 : 0}%`,
            backgroundColor: 'rgba(255,255,255,0.4)',
            borderRadius: '999px',
          }} />
          {/* Played progress */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${duration ? (currentTime / duration) * 100 : 0}%`,
            backgroundColor: '#00ff66',
            boxShadow: '0 0 8px #00ff66',
            borderRadius: '999px',
          }} />
        </div>

        {/* Bottom Control Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          fontSize: '0.85rem',
        }}>
          {/* Left Actions: Play/Pause, Skip, Volume, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={togglePlay}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(-10)}
              title="-10s"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>replay_10</span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(10)}
              title="+10s"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>forward_10</span>
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}
                </span>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                style={{
                  width: '60px',
                  height: '4px',
                  accentColor: '#00ff66',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Time Stamp */}
            <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Actions: Speed, Quality, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            {/* Speed Selector */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '36px',
                  right: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '8px',
                  padding: '6px 0',
                  minWidth: '90px',
                  zIndex: 20,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <div
                      key={speed}
                      onClick={() => handleSpeedSelect(speed)}
                      style={{
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: playbackSpeed === speed ? 800 : 500,
                        color: playbackSpeed === speed ? '#00ff66' : '#ffffff',
                        backgroundColor: playbackSpeed === speed ? 'rgba(0,255,102,0.1)' : 'transparent',
                      }}
                    >
                      {speed}x
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>settings</span>
                  <span>{currentQuality === -1 ? 'Auto' : qualities[currentQuality]?.name || 'HD'}</span>
                </button>

                {showQualityMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '36px',
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '8px',
                    padding: '6px 0',
                    minWidth: '100px',
                    zIndex: 20,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    <div
                      onClick={() => handleQualitySelect(-1)}
                      style={{
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: currentQuality === -1 ? 800 : 500,
                        color: currentQuality === -1 ? '#00ff66' : '#ffffff',
                        backgroundColor: currentQuality === -1 ? 'rgba(0,255,102,0.1)' : 'transparent',
                      }}
                    >
                      Auto
                    </div>
                    {qualities.map(q => (
                      <div
                        key={q.id}
                        onClick={() => handleQualitySelect(q.id)}
                        style={{
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: currentQuality === q.id ? 800 : 500,
                          color: currentQuality === q.id ? '#00ff66' : '#ffffff',
                          backgroundColor: currentQuality === q.id ? 'rgba(0,255,102,0.1)' : 'transparent',
                        }}
                      >
                        {q.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
