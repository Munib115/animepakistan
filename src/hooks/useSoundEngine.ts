// /hooks/useSoundEngine.ts

'use client';
import { useRef, useCallback } from 'react';

let sharedCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let introPlayed = false;

export function triggerHaptic(pattern: number | number[] = 15) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function getCtx(): { ac: AudioContext; master: GainNode } {
  if (!sharedCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedCtx = new AudioCtx();
      masterGain = sharedCtx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(sharedCtx.destination);
    }
  }
  if (sharedCtx && sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return { ac: sharedCtx!, master: masterGain! };
}

function chain(ac: AudioContext, node: AudioNode): GainNode {
  const g = ac.createGain();
  node.connect(g);
  g.connect(masterGain!);
  return g;
}

// ── individual sound functions ──────────────────────────────────────────────

function playSoftClick() {
  triggerHaptic(10);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [{ f: 880, vol: 0.45 }, { f: 1100, vol: 0.18 }].forEach(({ f, vol }) => {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.start(t);
    o.stop(t + 0.09);
  });
}

function playButtonPop() {
  triggerHaptic(18);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = chain(ac, o);
  o.type = 'sine';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.start(t);
  o.stop(t + 0.2);
}

function playChimeTap() {
  triggerHaptic([12, 30, 15]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [1047, 1319, 1568].forEach((freq, i) => {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'sine';
    o.frequency.value = freq;
    const s = t + i * 0.04;
    g.gain.setValueAtTime(0.28, s);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    o.start(s);
    o.stop(s + 0.36);
  });
}

function playGlitchTap() {
  triggerHaptic([8, 18, 10]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 4; i++) {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'square';
    o.frequency.value = 300 + Math.random() * 600;
    const s = t + i * 0.018;
    g.gain.setValueAtTime(0.18, s);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.03);
    o.start(s);
    o.stop(s + 0.04);
  }
}

function playHoverTick() {
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = chain(ac, o);
  o.type = 'sine';
  o.frequency.value = 1200;
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t);
  o.stop(t + 0.05);
}

function playSuccessChime() {
  triggerHaptic([15, 30, 25]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]].forEach(([freq, delay]) => {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'sine';
    o.frequency.value = freq;
    const s = t + delay;
    g.gain.setValueAtTime(0.35, s);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    o.start(s);
    o.stop(s + 0.36);
  });
}

function playNotification() {
  triggerHaptic([20, 40, 20]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [{ f: 880, d: 0 }, { f: 1100, d: 0.16 }].forEach(({ f, d }) => {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'sine';
    o.frequency.value = f;
    const s = t + d;
    g.gain.setValueAtTime(0.38, s);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.15);
    o.start(s);
    o.stop(s + 0.16);
  });
}

function playEpisodeNext() {
  triggerHaptic([15, 35, 15]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = chain(ac, o);
  o.type = 'sine';
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
  g.gain.setValueAtTime(0.42, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.start(t);
  o.stop(t + 0.3);
}

function playSiteIntro() {
  if (introPlayed) return;
  introPlayed = true;
  triggerHaptic([20, 50, 30]);
  const { ac } = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const notes: [number, number, number][] = [
    [523, 0, 0.25],
    [659, 0.22, 0.25],
    [784, 0.44, 0.3],
    [1047, 0.66, 0.5],
    [880, 0.95, 0.3],
    [1047, 1.15, 0.8],
  ];
  notes.forEach(([freq, onset, dur]) => {
    const o = ac.createOscillator();
    const g = chain(ac, o);
    o.type = 'sine';
    o.frequency.value = freq;
    const s = t + onset;
    g.gain.setValueAtTime(0.001, s);
    g.gain.linearRampToValueAtTime(0.32, s + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, s + dur);
    o.start(s);
    o.stop(s + dur + 0.05);
  });
  const pad = ac.createOscillator();
  const pg = chain(ac, pad);
  pad.type = 'sine';
  pad.frequency.value = 130;
  pg.gain.setValueAtTime(0.001, t);
  pg.gain.linearRampToValueAtTime(0.14, t + 0.3);
  pg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
  pad.start(t);
  pad.stop(t + 1.9);
}

// ── hook ────────────────────────────────────────────────────────────────────

export function useSoundEngine() {
  const mutedRef = useRef(false);

  const play = useCallback((sound: keyof typeof soundMap) => {
    if (mutedRef.current) return;
    soundMap[sound]?.();
  }, []);

  const mute = useCallback(() => {
    mutedRef.current = true;
    if (masterGain) masterGain.gain.value = 0;
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    if (masterGain) masterGain.gain.value = 0.8;
  }, []);

  const setVolume = useCallback((v: number) => {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
  }, []);

  const haptic = useCallback((pattern: number | number[] = 15) => {
    triggerHaptic(pattern);
  }, []);

  return { play, mute, unmute, setVolume, isMuted: mutedRef.current, haptic };
}

export const soundMap = {
  softClick: playSoftClick,
  buttonPop: playButtonPop,
  chimeTap: playChimeTap,
  glitchTap: playGlitchTap,
  hoverTick: playHoverTick,
  successChime: playSuccessChime,
  notification: playNotification,
  episodeNext: playEpisodeNext,
  siteIntro: playSiteIntro,
} as const;

export type SoundName = keyof typeof soundMap;
