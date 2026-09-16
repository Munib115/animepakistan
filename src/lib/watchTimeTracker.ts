// Advanced Real-Time Watch Time Tracker for AnimePakistan
// Sourced from battle-tested open-source time-on-site & activity-tracking architectures (timeonsite.js / activity-detector)
// Tracks precise real-time session duration, daily watch time, and lifetime website engagement
// Incorporates Page Visibility API, video playback detection, and idle suspension

export interface WatchTimeStats {
  totalSeconds: number;       // All-time accumulated seconds on AnimePakistan
  todaySeconds: number;       // Seconds spent today
  sessionSeconds: number;     // Seconds in the current active tab session
  todayDate: string;          // Current date key (YYYY-MM-DD) for daily tracking
  lastActiveTimestamp: number;
}

const STORAGE_KEY = 'ap_watch_time_stats';
const IDLE_TIMEOUT_MS = 120 * 1000; // 2 minutes idle threshold when no video is playing

const getTodayDateString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function formatWatchDuration(seconds: number, isUrdu: boolean = false): {
  primary: string;
  unit: string;
  breakdown: string;
} {
  const sec = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSecs = sec % 60;

  if (hours > 0) {
    const primary = isUrdu ? `${hours}گھنٹے ${minutes}منٹ` : `${hours}h ${minutes}m`;
    const unit = isUrdu ? 'کل واچ ٹائم' : 'Total Watched';
    const breakdown = isUrdu ? `${hours} گھنٹے ${minutes} منٹ` : `${hours} hrs ${minutes} mins`;
    return { primary, unit, breakdown };
  }

  if (minutes > 0) {
    const primary = isUrdu ? `${minutes}منٹ ${remSecs}سیکنڈ` : `${minutes}m ${remSecs}s`;
    const unit = isUrdu ? 'منٹ واچ ٹائم' : 'Mins Watched';
    const breakdown = isUrdu ? `${minutes} منٹ ${remSecs} سیکنڈ` : `${minutes} mins ${remSecs} secs`;
    return { primary, unit, breakdown };
  }

  const primary = isUrdu ? `${remSecs} سیکنڈ` : `${remSecs}s`;
  const unit = isUrdu ? 'سیکنڈ' : 'Seconds';
  const breakdown = isUrdu ? `${remSecs} سیکنڈ` : `${remSecs} seconds`;
  return { primary, unit, breakdown };
}

export function formatCompactTime(seconds: number, isUrdu: boolean = false): string {
  const sec = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSecs = sec % 60;

  if (hours > 0) {
    return isUrdu ? `${hours}گھنٹہ ${minutes}منٹ` : `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return isUrdu ? `${minutes}منٹ` : `${minutes}m ${remSecs}s`;
  }
  return isUrdu ? `${remSecs}سیکنڈ` : `${remSecs}s`;
}

class WatchTimeTrackerEngine {
  private stats: WatchTimeStats = {
    totalSeconds: 0,
    todaySeconds: 0,
    sessionSeconds: 0,
    todayDate: getTodayDateString(),
    lastActiveTimestamp: Date.now(),
  };

  private initialized: boolean = false;
  private intervalId: any = null;
  private lastActivityTime: number = Date.now();
  private isDocumentVisible: boolean = true;
  private saveDebounceCounter: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.loadFromStorage();
    this.lastActivityTime = Date.now();
    this.isDocumentVisible = document.visibilityState === 'visible';

    // Activity listeners
    const onUserAction = () => {
      this.lastActivityTime = Date.now();
    };

    window.addEventListener('mousemove', onUserAction, { passive: true });
    window.addEventListener('keydown', onUserAction, { passive: true });
    window.addEventListener('touchstart', onUserAction, { passive: true });
    window.addEventListener('scroll', onUserAction, { passive: true });
    window.addEventListener('click', onUserAction, { passive: true });

    // Page visibility listener
    document.addEventListener('visibilitychange', () => {
      this.isDocumentVisible = document.visibilityState === 'visible';
      if (this.isDocumentVisible) {
        this.lastActivityTime = Date.now();
      } else {
        this.persistToStorage();
      }
    });

    // Save on beforeunload
    window.addEventListener('beforeunload', () => {
      this.persistToStorage();
    });

    // Start 1-second accurate ticker
    this.startTicker();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const currentDate = getTodayDateString();

      if (raw) {
        const parsed: Partial<WatchTimeStats> = JSON.parse(raw);
        const total = typeof parsed.totalSeconds === 'number' && !isNaN(parsed.totalSeconds) ? parsed.totalSeconds : 0;
        const isSameDay = parsed.todayDate === currentDate;
        const today = isSameDay && typeof parsed.todaySeconds === 'number' && !isNaN(parsed.todaySeconds)
          ? parsed.todaySeconds
          : 0;

        this.stats = {
          totalSeconds: Math.max(0, total),
          todaySeconds: Math.max(0, today),
          sessionSeconds: 0,
          todayDate: currentDate,
          lastActiveTimestamp: Date.now(),
        };
      } else {
        this.stats = {
          totalSeconds: 0,
          todaySeconds: 0,
          sessionSeconds: 0,
          todayDate: currentDate,
          lastActiveTimestamp: Date.now(),
        };
      }
    } catch (e) {
      this.stats = {
        totalSeconds: 0,
        todaySeconds: 0,
        sessionSeconds: 0,
        todayDate: getTodayDateString(),
        lastActiveTimestamp: Date.now(),
      };
    }
  }

  private isMediaPlaying(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const videos = document.querySelectorAll('video');
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (!v.paused && !v.ended && v.readyState > 2) {
          return true;
        }
      }
      const audios = document.querySelectorAll('audio');
      for (let i = 0; i < audios.length; i++) {
        const a = audios[i];
        if (!a.paused && !a.ended) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  private isUserActive(): boolean {
    // If video or audio is actively playing, user is watching anime even if hands off keyboard/mouse
    if (this.isMediaPlaying()) return true;

    // If tab is hidden and no media is playing, suspend counting
    if (!this.isDocumentVisible) return false;

    // In foreground, check idle timeout
    const timeSinceLastAction = Date.now() - this.lastActivityTime;
    return timeSinceLastAction <= IDLE_TIMEOUT_MS;
  }

  private startTicker() {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      const active = this.isUserActive();
      if (active) {
        const currentDate = getTodayDateString();
        // Day rollover check
        if (this.stats.todayDate !== currentDate) {
          this.stats.todayDate = currentDate;
          this.stats.todaySeconds = 0;
        }

        this.stats.sessionSeconds += 1;
        this.stats.todaySeconds += 1;
        this.stats.totalSeconds += 1;
        this.stats.lastActiveTimestamp = Date.now();

        // Dispatch real-time update event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ap_watch_time_updated', {
              detail: { ...this.stats, isActive: true },
            })
          );
        }

        // Debounce storage write to every 4 seconds to protect mobile flash storage
        this.saveDebounceCounter += 1;
        if (this.saveDebounceCounter >= 4) {
          this.saveDebounceCounter = 0;
          this.persistToStorage();
        }
      } else {
        // Dispatch idle update
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ap_watch_time_updated', {
              detail: { ...this.stats, isActive: false },
            })
          );
        }
      }
    }, 1000);
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (e) {}
  }

  public getStats(): WatchTimeStats & { isActive: boolean } {
    return {
      ...this.stats,
      isActive: this.isUserActive(),
    };
  }

  public resetStats() {
    this.stats = {
      totalSeconds: 0,
      todaySeconds: 0,
      sessionSeconds: 0,
      todayDate: getTodayDateString(),
      lastActiveTimestamp: Date.now(),
    };
    this.persistToStorage();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ap_watch_time_updated', {
          detail: { ...this.stats, isActive: true },
        })
      );
    }
  }
}

// Global Singleton
export const watchTimeTracker = new WatchTimeTrackerEngine();
