'use client';

import React, { useState, useEffect, useRef } from 'react';
import { sound } from '@/lib/soundEngine';

interface VoiceAudioPlayerProps {
  src: string;
  duration?: number;
  onDelete?: () => void;
  isOwner?: boolean;
}

export default function VoiceAudioPlayer({ src, duration, onDelete, isOwner = false }: VoiceAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate deterministic pseudo waveform heights based on src hash
  const waveformBars = React.useMemo(() => {
    const bars: number[] = [];
    let seed = 0;
    for (let i = 0; i < src.length; i++) {
      seed = (seed + src.charCodeAt(i) * 31) % 1000;
    }
    for (let i = 0; i < 28; i++) {
      const pseudo = Math.sin(seed + i * 1.4) * 0.5 + 0.5;
      const height = Math.floor(25 + pseudo * 70); // 25% to 95%
      bars.push(height);
    }
    return bars;
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    sound.playButton();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio || totalDuration <= 0) return;
    const targetPercent = index / waveformBars.length;
    const seekTime = targetPercent * totalDuration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1.5px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      padding: '8px 16px',
      borderRadius: '999px',
      maxWidth: '100%',
      width: '360px',
      boxSizing: 'border-box',
    }}>
      {/* Hidden Native Audio Element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #00cc66 0%, #006633 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 102, 51, 0.35)',
          flexShrink: 0,
          transition: 'transform 0.15s ease',
        }}
        className="glass-audio-play-btn"
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px', marginLeft: isPlaying ? '0' : '2px' }}>
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>

      {/* Waveform & Time Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, gap: '4px' }}>
        {/* Waveform Equalizer Bars */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '24px',
            cursor: 'pointer',
            padding: '2px 0',
          }}
          title="Click to seek"
        >
          {waveformBars.map((height, idx) => {
            const barPercent = (idx / waveformBars.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{
                  flex: 1,
                  height: `${height}%`,
                  borderRadius: '999px',
                  background: isPassed 
                    ? 'linear-gradient(to top, #006633, #00cc66)' 
                    : 'rgba(0, 102, 51, 0.18)',
                  boxShadow: isPassed ? '0 0 6px rgba(0, 204, 102, 0.4)' : 'none',
                  transition: 'height 0.2s ease, background 0.1s ease',
                  minWidth: '2px',
                  maxWidth: '5px',
                }}
              />
            );
          })}
        </div>

        {/* Duration & WebRTC ANC indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'monospace' }}>
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : '0:00'} / {formatTime(totalDuration || duration || 0)}
          </span>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            color: 'var(--color-primary)',
            fontWeight: 800,
            fontSize: '0.62rem',
            background: 'rgba(0, 102, 51, 0.08)',
            padding: '2px 8px',
            borderRadius: '999px',
            letterSpacing: '0.02em',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00cc66', display: 'inline-block' }} />
            ANC HD
          </span>
        </div>
      </div>

      {/* Delete button (if allowed) */}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          style={{
            border: 'none',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
          title="Delete voice note"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
        </button>
      )}
    </div>
  );
}
