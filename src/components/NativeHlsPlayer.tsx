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
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
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
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [doubleClickFeedback, setDoubleClickFeedback] = useState<'left' | 'right' | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

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
    }, 3500);
  }, [isPlaying]);

  // Direct MP4 vs HLS Stream handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const isDirectMp4 =
      streamUrl.toLowerCase().includes('.mp4') ||
      streamUrl.includes('/api/stream/local-video') ||
      streamUrl.startsWith('/videos/');

    if (isDirectMp4) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.preload = 'auto';
      video.src = streamUrl;
      video.load();

      setQualities([{ id: 0, height: 1080, name: '1080p FHD' }]);
      setCurrentQuality(0);

      const onLoadedMeta = () => {
        setDuration(video.duration || 0);
        setIsBuffering(false);
        if (initialTime > 0) {
          video.currentTime = initialTime;
        }
      };

      const onCanPlay = () => setIsBuffering(false);
      const onWaiting = () => setIsBuffering(true);
      const onPlaying = () => {
        setIsBuffering(false);
        setIsPlaying(true);
      };
      const onPause = () => setIsPlaying(false);
      const onErrorEvt = () => {
        console.warn('[NativeHlsPlayer] MP4 video error event fired');
        setIsBuffering(false);
        if (onError) onError();
      };

      video.addEventListener('loadedmetadata', onLoadedMeta);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('pause', onPause);
      video.addEventListener('error', onErrorEvt);

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMeta);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('error', onErrorEvt);
      };
    }

    // HLS.js for m3u8 streams
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
      });

      hls.on(Hls.Events.ERROR, (_, err) => {
        if (err.fatal) {
          console.warn('[NativeHlsPlayer] HLS fatal error:', err.details);
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
      // Native iOS Safari HLS
      video.src = streamUrl;
      const onLoaded = () => {
        setIsBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', () => { if (onError) onError(); });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, onError, initialTime]);

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

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setIsBuffering(true);
      video.play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch((err) => {
          console.warn('[NativeHlsPlayer] play() rejected:', err);
          setIsPlaying(false);
          setIsBuffering(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleSeek = (clientX: number) => {
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !duration || !bar) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    handleSeek(e.clientX);
    resetControlsTimer();
  };

  const handleProgressBarTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches && e.touches[0]) {
      handleSeek(e.touches[0].clientX);
      resetControlsTimer();
    }
  };

  const handleSkip = (seconds: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration || video.duration, video.currentTime + seconds));
    resetControlsTimer();
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
    resetControlsTimer();
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    resetControlsTimer();
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const isCurrentFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );

    if (!isCurrentFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((video as any)?.webkitEnterFullscreen) {
        // iOS Safari Fullscreen
        (video as any).webkitEnterFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
    resetControlsTimer();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.code === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleSkip(10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.1));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.1));
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
  }, [volume, isMuted, togglePlay]);

  // Touch screen interaction: single tap toggles controls, double tap seeks
  const handleContainerTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;

    if (now - lastTapRef.current.time < 300) {
      // Double tap detected!
      if (relativeX < rect.width * 0.4) {
        handleSkip(-10);
        setDoubleClickFeedback('left');
        setTimeout(() => setDoubleClickFeedback(null), 600);
      } else if (relativeX > rect.width * 0.6) {
        handleSkip(10);
        setDoubleClickFeedback('right');
        setTimeout(() => setDoubleClickFeedback(null), 600);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: relativeX };
      setShowControls((prev) => !prev);
      resetControlsTimer();
    }
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
      resetControlsTimer();
    }
  };

  const handleQualitySelect = (qualityId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityId;
      setCurrentQuality(qualityId);
      setShowQualityMenu(false);
      resetControlsTimer();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onTouchStart={handleContainerTouch}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <style>{`
        .ap-player-btn {
          background: none;
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .ap-player-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .ap-player-btn:active {
          transform: scale(0.92);
        }
        .ap-volume-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        @media (max-width: 640px) {
          .ap-volume-slider {
            display: none !important;
          }
          .ap-hide-mobile {
            display: none !important;
          }
          .ap-controls-bar {
            padding: 8px 12px !important;
            gap: 6px !important;
          }
          .ap-controls-actions {
            font-size: 0.75rem !important;
          }
          .ap-time-text {
            font-size: 0.72rem !important;
          }
        }
      `}</style>

      {/* Main Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000000',
          cursor: showControls ? 'pointer' : 'none',
        }}
      />

      {/* Double Tap Ripple Feedback Indicators */}
      {doubleClickFeedback === 'left' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '20%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.75)',
          color: '#00ff66',
          padding: '10px 18px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 15,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
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
          backgroundColor: 'rgba(0,0,0,0.75)',
          color: '#00ff66',
          padding: '10px 18px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 15,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}>
          <span className="material-symbols-outlined">forward_10</span>
          <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>+10s</span>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 8,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '4px solid rgba(0, 255, 102, 0.2)',
            borderTopColor: '#00ff66',
            animation: 'spin 0.8s linear infinite',
            boxShadow: '0 0 20px rgba(0, 255, 102, 0.5)',
          }} />
        </div>
      )}

      {/* Big Center Play Button (Always visible when paused) */}
      {!isPlaying && (
        <div
          onClick={(e) => togglePlay(e)}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 255, 102, 0.95)',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 9,
            boxShadow: '0 0 30px rgba(0, 255, 102, 0.65)',
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '36px', marginLeft: '3px' }}>
            play_arrow
          </span>
        </div>
      )}

      {/* Top Banner (Title & 1080p Badge) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 7,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.25s ease',
      }}>
        <div style={{
          color: '#ffffff',
          fontSize: '0.88rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: '12px',
        }}>
          {title || 'Playing Movie'}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#00ff66',
            backgroundColor: 'rgba(0, 255, 102, 0.15)',
            border: '1px solid rgba(0, 255, 102, 0.4)',
            padding: '2px 8px',
            borderRadius: '999px',
            letterSpacing: '0.04em',
          }}>
            1080p FHD
          </span>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className="ap-controls-bar"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 18px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 65%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 8,
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transform: showControls ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        {/* Progress Bar with comfortable touch hit area */}
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          onTouchStart={handleProgressBarTouch}
          onTouchMove={handleProgressBarTouch}
          style={{
            width: '100%',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          <div style={{
            width: '100%',
            height: '5px',
            backgroundColor: 'rgba(255,255,255,0.22)',
            borderRadius: '999px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Buffered Bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${duration ? (bufferedEnd / duration) * 100 : 0}%`,
              backgroundColor: 'rgba(255,255,255,0.4)',
              borderRadius: '999px',
            }} />
            {/* Played Bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              backgroundColor: '#00ff66',
              boxShadow: '0 0 10px #00ff66',
              borderRadius: '999px',
            }} />
          </div>
        </div>

        {/* Control Actions Row (Responsive) */}
        <div
          className="ap-controls-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
            fontSize: '0.85rem',
            width: '100%',
          }}
        >
          {/* Left Actions: Play/Pause, Skip 10s, Volume, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="ap-player-btn"
              onClick={(e) => togglePlay(e)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              type="button"
              className="ap-player-btn ap-hide-mobile"
              onClick={(e) => handleSkip(-10, e)}
              title="-10s"
              aria-label="Skip backwards 10 seconds"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>replay_10</span>
            </button>

            <button
              type="button"
              className="ap-player-btn ap-hide-mobile"
              onClick={(e) => handleSkip(10, e)}
              title="+10s"
              aria-label="Skip forward 10 seconds"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>forward_10</span>
            </button>

            {/* Volume Control */}
            <div className="ap-volume-box">
              <button
                type="button"
                className="ap-player-btn"
                onClick={(e) => toggleMute(e)}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}
                </span>
              </button>
              <input
                type="range"
                className="ap-volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '56px',
                  height: '4px',
                  accentColor: '#00ff66',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Time Stamp */}
            <span className="ap-time-text" style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginLeft: '4px' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Actions: Speed, Quality, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {/* Speed Selector */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="ap-player-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.96)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '8px',
                  padding: '4px 0',
                  minWidth: '85px',
                  zIndex: 25,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <div
                      key={speed}
                      onClick={() => handleSpeedSelect(speed)}
                      style={{
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: playbackSpeed === speed ? 800 : 500,
                        color: playbackSpeed === speed ? '#00ff66' : '#ffffff',
                        backgroundColor: playbackSpeed === speed ? 'rgba(0,255,102,0.12)' : 'transparent',
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
                  className="ap-player-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    gap: '3px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>settings</span>
                  <span>{currentQuality === -1 ? 'Auto' : qualities[currentQuality]?.name || 'HD'}</span>
                </button>

                {showQualityMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(16px)',
                    borderRadius: '8px',
                    padding: '4px 0',
                    minWidth: '95px',
                    zIndex: 25,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}>
                    {qualities.length > 1 && (
                      <div
                        onClick={() => handleQualitySelect(-1)}
                        style={{
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: currentQuality === -1 ? 800 : 500,
                          color: currentQuality === -1 ? '#00ff66' : '#ffffff',
                          backgroundColor: currentQuality === -1 ? 'rgba(0,255,102,0.12)' : 'transparent',
                        }}
                      >
                        Auto
                      </div>
                    )}
                    {qualities.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => handleQualitySelect(q.id)}
                        style={{
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: currentQuality === q.id ? 800 : 500,
                          color: currentQuality === q.id ? '#00ff66' : '#ffffff',
                          backgroundColor: currentQuality === q.id ? 'rgba(0,255,102,0.12)' : 'transparent',
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
              className="ap-player-btn"
              onClick={(e) => toggleFullscreen(e)}
              title="Fullscreen (F)"
              aria-label="Toggle Fullscreen"
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
