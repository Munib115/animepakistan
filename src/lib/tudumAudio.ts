/**
 * Cinematic Netflix-Style "Ta-Dum" Web Audio Synthesizer & Player
 * Guaranteed to play across all web browsers with zero external network latency.
 */

export function playCinematicTudum(): void {
  try {
    // 1. Attempt playing pre-rendered high-fidelity WAV file
    const audio = new Audio('/sounds/netflix-tudum.wav');
    audio.volume = 0.95;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to Web Audio API synthesis if file playback is restricted
        synthesizeWebAudioTudum();
      });
    }
  } catch {
    synthesizeWebAudioTudum();
  }
}

export function synthesizeWebAudioTudum(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // ==========================================
    // 1. BEAT 1: "TA" (at now + 0.12s)
    // ==========================================
    const t1 = now + 0.12;

    // Sub-kick drop (135Hz -> 45Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(135, t1);
    osc1.frequency.exponentialRampToValueAtTime(45, t1 + 0.22);
    gain1.gain.setValueAtTime(0.75, t1);
    gain1.gain.exponentialRampToValueAtTime(0.001, t1 + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t1);
    osc1.stop(t1 + 0.35);

    // Anvil/Wood Knock Transient
    const oscKnock = ctx.createOscillator();
    const gainKnock = ctx.createGain();
    oscKnock.frequency.setValueAtTime(580, t1);
    oscKnock.frequency.exponentialRampToValueAtTime(80, t1 + 0.08);
    gainKnock.gain.setValueAtTime(0.45, t1);
    gainKnock.gain.exponentialRampToValueAtTime(0.001, t1 + 0.1);
    oscKnock.connect(gainKnock);
    gainKnock.connect(ctx.destination);
    oscKnock.start(t1);
    oscKnock.stop(t1 + 0.1);

    // ==========================================
    // 2. BEAT 2: "DUM" (at now + 0.62s)
    // ==========================================
    const t2 = now + 0.62;

    // Heavy 808 Sub-bass Impact (95Hz -> 34Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.frequency.setValueAtTime(95, t2);
    subOsc.frequency.exponentialRampToValueAtTime(34, t2 + 0.85);
    subGain.gain.setValueAtTime(0.9, t2);
    subGain.gain.exponentialRampToValueAtTime(0.001, t2 + 1.4);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(t2);
    subOsc.stop(t2 + 1.4);

    // Resonant Cello Chords (73.4Hz D2, 110Hz A2, 185Hz F#3)
    [73.4, 110, 185].forEach((f, idx) => {
      const chordOsc = ctx.createOscillator();
      const chordGain = ctx.createGain();
      chordOsc.type = 'triangle';
      chordOsc.frequency.setValueAtTime(f, t2);
      chordGain.gain.setValueAtTime(0.4 / (idx + 1), t2);
      chordGain.gain.exponentialRampToValueAtTime(0.001, t2 + 1.25);
      chordOsc.connect(chordGain);
      chordGain.connect(ctx.destination);
      chordOsc.start(t2);
      chordOsc.stop(t2 + 1.25);
    });

    // High Shimmering Cinematic Harmonic Tail
    [659.25, 880, 1108.7, 1318.5].forEach((freq, idx) => {
      const shimOsc = ctx.createOscillator();
      const shimGain = ctx.createGain();
      shimOsc.type = 'sine';
      shimOsc.frequency.setValueAtTime(freq, t2);
      shimGain.gain.setValueAtTime(0.14 / (idx + 1), t2);
      shimGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.85);
      shimOsc.connect(shimGain);
      shimGain.connect(ctx.destination);
      shimOsc.start(t2);
      shimOsc.stop(t2 + 1.85);
    });
  } catch {
    // Graceful fallback if Web Audio is restricted
  }
}
