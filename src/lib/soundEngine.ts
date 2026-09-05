// Web Audio API & HTML5 UI Sound Engine with Automatic Autoplay Unlocking & Hardware Haptics

class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ap_ui_sound_enabled');
        this.soundEnabled = stored === null ? true : stored === 'true';
      } catch (e) {}

      // Auto-unlock AudioContext on first user interaction anywhere on page
      const unlockAudio = () => {
        this.unlock();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };

      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }
  }

  public unlock() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
    } catch (e) {}
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ap_ui_sound_enabled', enabled ? 'true' : 'false');
      } catch (e) {}
    }
  }

  // Trigger mobile hardware haptic vibration
  public haptic(pattern: number | number[] = 15) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  // 1. Anime Card Click Sound (Rich, pleasant liquid bubble pop)
  public playCardClick() {
    this.haptic(18);
    if (!this.soundEnabled) return;
    this.unlock();

    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pleasant bubbly drop from 680Hz to 380Hz
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.11);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // 2. Episode Selection Sound (Crisp, premium high-tech harmonic chime)
  public playEpisodeSelect() {
    this.haptic([15, 30, 20]);
    if (!this.soundEnabled) return;
    this.unlock();

    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Primary Chime Tone (A5 -> E6)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.06);

      gain1.gain.setValueAtTime(0.32, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.17);

      // Bell Harmonic Resonance
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.02);

      gain2.gain.setValueAtTime(0.18, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc2.start(now + 0.02);
      osc2.stop(now + 0.23);
    } catch (e) {}
  }

  // 3. Tab Switch & Filter Click Sound (Sleek acoustic snap)
  public playTabSwitch() {
    this.haptic(12);
    if (!this.soundEnabled) return;
    this.unlock();

    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.05);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.065);
    } catch (e) {}
  }

  // 4. Button & Control Click Sound
  public playButton() {
    this.haptic(10);
    if (!this.soundEnabled) return;
    this.unlock();

    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.04);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.055);
    } catch (e) {}
  }

  // 5. Pakistan National Anthem Musical Beat / Motif (Iconic 1.8s "Pak Sarzamin Shad Bad" opening fanfare)
  public playAnthemBeat() {
    if (!this.soundEnabled) return;
    this.unlock();

    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Melody Notes: F4, A4, C5, F5, E5, D5, C5 ("Pak sarzamin shad bad")
      const notes = [
        { freq: 349.23, time: 0.00, dur: 0.24 }, // Pak
        { freq: 440.00, time: 0.25, dur: 0.20 }, // sar-
        { freq: 523.25, time: 0.46, dur: 0.22 }, // za-
        { freq: 698.46, time: 0.69, dur: 0.34 }, // min
        { freq: 659.25, time: 1.04, dur: 0.22 }, // shad
        { freq: 587.33, time: 1.27, dur: 0.22 }, // bad
        { freq: 523.25, time: 1.50, dur: 0.45 }, // final cadence
      ];

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.28, now);
      masterGain.connect(this.ctx.destination);

      notes.forEach(({ freq, time, dur }) => {
        if (!this.ctx) return;
        const noteStart = now + time;
        const noteEnd = noteStart + dur;

        // Primary Brass/Wind oscillator (triangle wave)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, noteStart);

        gain1.gain.setValueAtTime(0.0001, noteStart);
        gain1.gain.linearRampToValueAtTime(0.22, noteStart + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc1.connect(gain1);
        gain1.connect(masterGain);

        osc1.start(noteStart);
        osc1.stop(noteEnd + 0.05);

        // Harmonic overtone (sine wave)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, noteStart);

        gain2.gain.setValueAtTime(0.0001, noteStart);
        gain2.gain.linearRampToValueAtTime(0.08, noteStart + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc2.start(noteStart);
        osc2.stop(noteEnd + 0.05);
      });
    } catch (e) {}
  }

  // Convenience aliases
  public pop() {
    this.playCardClick();
  }

  public click() {
    this.playButton();
  }
}

export const sound = new SoundEngine();
