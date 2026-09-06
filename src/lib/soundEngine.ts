import { soundMap, triggerHaptic, type SoundName } from '@/hooks/useSoundEngine';

class SoundEngine {
  private soundEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ap_ui_sound_enabled');
        this.soundEnabled = stored === null ? true : stored === 'true';
      } catch (e) {}
    }
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

  // Mobile Hardware Haptics
  public haptic(pattern: number | number[] = 15) {
    triggerHaptic(pattern);
  }

  // Play any of the programmatic Web Audio API sounds
  public play(name: SoundName) {
    if (!this.soundEnabled) return;
    soundMap[name]?.();
  }

  // New Programmatic Sound Effects
  public softClick() {
    this.play('softClick');
  }

  public buttonPop() {
    this.play('buttonPop');
  }

  public chimeTap() {
    this.play('chimeTap');
  }

  public glitchTap() {
    this.play('glitchTap');
  }

  public hoverTick() {
    this.play('hoverTick');
  }

  public successChime() {
    this.play('successChime');
  }

  public notification() {
    this.play('notification');
  }

  public episodeNext() {
    this.play('episodeNext');
  }

  public siteIntro() {
    this.play('siteIntro');
  }

  // Backward-compatible UI method mappings upgraded to new sound engine
  public playCardClick() {
    this.play('chimeTap');
  }

  public playEpisodeSelect() {
    this.play('chimeTap');
  }

  public playTabSwitch() {
    this.play('glitchTap');
  }

  public playButton() {
    this.play('buttonPop');
  }

  public playAnthemBeat() {
    this.play('siteIntro');
  }

  public pop() {
    this.play('buttonPop');
  }

  public click() {
    this.play('softClick');
  }

  public unlock() {
    // Lazy AudioContext handles unlock automatically on first play
  }
}

export const sound = new SoundEngine();
export type { SoundName };
