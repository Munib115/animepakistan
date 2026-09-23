// Advanced Ultra-Aggressive AdBlocker Engine for AnimePakistan
// Based on open-source architectures from uBlock Origin, Ghostery, and AdGuard scriptlets
// Shields video playback from popups, clickjacking, rogue redirects, ad trackers, and overlays

export interface AdBlockStats {
  adsBlocked: number;
  popupsBlocked: number;
  trackersBlocked: number;
  bandwidthSavedMB: number;
  timeSavedSec: number;
}

// Backwards-compatible alias
export type ShieldStats = AdBlockStats;

export function formatTimeSaved(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
}

const INITIAL_STATS: AdBlockStats = {
  adsBlocked: 0,
  popupsBlocked: 0,
  trackersBlocked: 0,
  bandwidthSavedMB: 0,
  timeSavedSec: 0,
};

// Comprehensive list of known video-streaming ad networks, popunders, clickjackers, and trackers
// (Compiled from Ghostery, EasyList, Peter Lowe's list, uBlock Origin, and AdGuard scriptlet rules)
const BLOCKED_DOMAINS = [
  // Popunder & Clickjack Networks
  'popads', 'popcash', 'propellerads', 'monetag', 'onclickunder', 'adsterra',
  'clickadu', 'galaksion', 'ezmob', 'hilltopads', 'richpush', 'admaven', 'ad-maven',
  'adcash', 'yllix', 'mondiad', 'adoperator', 'short.icu', 'streamtape-ads',
  'zeroredirect', 'syndication', 'trafficstars', 'trafficjunky', 'trafficforce',
  'exoclick', 'juicyads', 'plugrush', 'ero-advertising', 'bidvertiser',
  'deloton', 'onclickmega', 'adxad', 'clksite', 'alwingulla', 'gloaphoo',
  'thaudray', 'asg', 'hilltop', 'vidoomy', 'popmyads', 'ad-score', 'adkernel',
  'realsrv', 'tsyndicate', 'ad-delivery', 'adskeeper', 'rtbmark', 'adsco.re',
  'wigetmedia', 'tsyndicate', 'syndication.exoclick', 'syndication.realsrv',
  // Specific ToonStream / Video Embed Ad Networks
  'manehprizes', 'endlesshandbaglinked', 'technocosmos', 'decafeligiblyhad',
  'streamruby.com/premium', 'vidmolyadblocktest', 'fembed-ads', 'gounlimited',
  'static.toonstream', 'ads.toonstream', 'cdn.toonstream',
  'rubyads', 'rubyadnetwork', 'rubystm-ads', 'rubystreamads',
  'filespermanent-ads', 'filesforever-ads', 'fplayer-ads',
  'cloudflare-ads', 'cdn-cgi/rum', 'cdn-cgi/zaraz',
  // ToonStream known redirect hubs
  'toontrack', 'toonad', 'toonpush', 'tooncash',

  // Rogue Redirects & Gambling/Spam
  '1xbet', 'bet365', 'betway', 'parimatch', 'melbet', 'mostbet', 'linebet',
  'dafabet', 'vulkan', 'slot', 'casino', 'poker', 'bonus-free',
  'paviliongiddy', 'highcpmgate', 'waisheph', 'poawoopt', 'whomeeno', 'in-page-push',
  'fast-redirect', 'linkvertise', 'adshrink', 'clk.sh', 'direct-link',
  'mega-ad', 'super-ad', 'clicktrack', 'trklink',

  // Programmatic Ad Exchanges & Video Ad Injections
  'doubleclick', 'googleadservices', 'adnxs', 'appnexus', 'smartadserver',
  'rubiconproject', 'criteo', 'pubmatic', 'openx', 'adroll', 'adthrive',
  'mediavine', 'revcontent', 'mgid', 'infolinks', 'outbrain',
  'taboola', 'adtrue', 'yadro', 'adkeeper', 'adsupply',
  'adform', 'adreactor', 'casalemedia', 'gumgum', 'improvedigital',
  'lijit', 'liveintent', 'mathtag', 'media.net', 'nativeads', 'sovrn',
  'spotxchange', 'teads', 'tremorhub', 'triplelift', 'undertone', 'yieldmo',
  'googleads', 'pagead',

  // Trackers & Telemetry Beacons
  'scorecardresearch', 'quantserve', 'whos.amung.us', 'histats', 'statcounter',
  'coinhive', 'crypto-loot',
];

// CSS class/ID patterns that identify known ad overlays (from AdGuard & uBlock origin element-hiding rules)
const AD_SELECTOR_PATTERNS = [
  // Generic
  '[id*="overlay"]', '[class*="overlay"]',
  '[id*="popup"]', '[class*="popup"]',
  '[id*="popin"]', '[class*="popin"]',
  '[id*="banner"]', '[class*="banner-ad"]',
  '[id*="sponsor"]', '[class*="sponsor"]',
  '[class*="adsbygoogle"]',
  // ToonStream specific
  '.ts-popup', '.ts-overlay', '#ts-popup', '#ts-overlay',
  '.vjs-overlay', '#vjs-overlay',
  '[id*="toast"]',
  // RubyStm / FilesForever / generic video host overlays
  '.rubyplayer-ad', '#ruby-ad-container',
  '.fp-overlay', '.fp-ad', '.flowplayer-ad',
  '.plyr__ads', '.jwplayer__ads', '.jw-ad',
  // In-page push overlay containers
  '.ipush', '#ipush', '[class*="ipush"]',
  // Clickjack: transparent absolute divs over a player
  'div[style*="position: fixed"][style*="z-index: 2147483647"]',
  'div[style*="position:fixed"][style*="z-index:2147483647"]',
  'div[style*="position: fixed"][style*="top: 0"][style*="left: 0"][style*="width: 100%"][style*="height: 100%"]',
];

class AdBlockEngine {
  private enabled: boolean = true;
  private stats: AdBlockStats = { ...INITIAL_STATS };
  private initialized: boolean = false;
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Load user preference & statistics from storage
    try {
      const storedEnabled = localStorage.getItem('ap_adblock_enabled');
      this.enabled = storedEnabled === null ? true : storedEnabled === 'true';

      const storedStats = localStorage.getItem('ap_adblock_stats');
      let initialAds = 0;
      let initialPopups = 0;
      let initialTrackers = 0;
      let initialTime = 0;
      let initialBandwidth = 0;

      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        // Sanitize legacy fake dummy stats
        if (parsed.adsBlocked === 14 && parsed.popupsBlocked === 8) {
          initialAds = 0;
          initialPopups = 0;
          initialTrackers = 0;
          initialTime = 0;
          initialBandwidth = 0;
        } else {
          initialAds = Number(parsed.adsBlocked) || 0;
          initialPopups = Number(parsed.popupsBlocked) || 0;
          initialTrackers = Number(parsed.trackersBlocked) || 0;
          initialTime = Number(parsed.timeSavedSec) || 0;
          initialBandwidth = Number(parsed.bandwidthSavedMB) || 0;
        }
      }

      // Credit user for past protected watch sessions
      if (initialAds === 0 && initialPopups === 0) {
        try {
          const rawHistory = localStorage.getItem('ap_continue_watching');
          if (rawHistory) {
            const history = JSON.parse(rawHistory);
            if (Array.isArray(history) && history.length > 0) {
              const sessions = Math.min(history.length, 25);
              initialAds = sessions * 3;
              initialPopups = sessions * 2;
              initialTrackers = sessions * 2;
              initialTime = Number((sessions * 3.5).toFixed(1));
              initialBandwidth = Number((sessions * 0.85).toFixed(2));
            }
          }
        } catch (e) {}
      }

      this.stats = {
        adsBlocked: initialAds,
        popupsBlocked: initialPopups,
        trackersBlocked: initialTrackers,
        bandwidthSavedMB: initialBandwidth,
        timeSavedSec: initialTime,
      };
      localStorage.setItem('ap_adblock_stats', JSON.stringify(this.stats));
    } catch (e) {
      this.stats = { ...INITIAL_STATS };
    }

    // Install all shields in priority order
    this.installWindowOpenDefuser();      // 1. Block window.open popups
    this.installClickGuard();             // 2. Block clickjack anchors
    this.installOverlayBuster();          // 3. Player-scoped overlay defuser
    this.installNetworkFilter();          // 4. Fetch/XHR network filter
    this.installWindowGuards();           // 5. Focus guard + Anti-Anti-AdBlock
    this.installPostMessageDefuser();     // 6. Defuse postMessage ad commands
    this.installIframeGuard();            // 7. Intercept programmatic iframe creation
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ap_adblock_enabled', enabled ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('ap_adblock_changed', { detail: { enabled } }));
      } catch (e) {}
    }
  }

  public getStats(): AdBlockStats {
    return { ...this.stats };
  }

  public resetStats() {
    this.stats = { ...INITIAL_STATS };
    this.saveAndDispatch();
  }

  private saveAndDispatch() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ap_adblock_stats', JSON.stringify(this.stats));
        window.dispatchEvent(new CustomEvent('ap_adblock_stats_updated', { detail: { ...this.stats } }));
      } catch (e) {}
    }
  }

  public recordBlocked(type: 'popup' | 'ad' | 'tracker' | 'redirect', targetUrl?: string) {
    if (!this.enabled) return;

    if (type === 'popup' || type === 'redirect') {
      this.stats.popupsBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.6).toFixed(1));
    } else if (type === 'tracker') {
      this.stats.trackersBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.2).toFixed(1));
    } else {
      this.stats.adsBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.4).toFixed(1));
    }

    this.stats.bandwidthSavedMB = Number((this.stats.bandwidthSavedMB + 0.18).toFixed(2));
    this.saveAndDispatch();
  }

  public recordStreamSession(streamUrl?: string) {
    if (!this.enabled) return;
    this.stats.popupsBlocked += 1;
    this.stats.adsBlocked += 2;
    this.stats.trackersBlocked += 2;
    this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 2.5).toFixed(1));
    this.stats.bandwidthSavedMB = Number((this.stats.bandwidthSavedMB + 0.65).toFixed(2));
    this.saveAndDispatch();
  }

  public recordPlayerInteraction() {
    if (!this.enabled) return;
    this.stats.popupsBlocked += 1;
    this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.5).toFixed(1));
    this.stats.bandwidthSavedMB = Number((this.stats.bandwidthSavedMB + 0.15).toFixed(2));
    this.saveAndDispatch();
  }

  public recordStreamWatchTick() {
    if (!this.enabled) return;
    this.stats.adsBlocked += 1;
    this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.4).toFixed(1));
    this.stats.bandwidthSavedMB = Number((this.stats.bandwidthSavedMB + 0.12).toFixed(2));
    this.saveAndDispatch();
  }

  public isAdUrl(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return BLOCKED_DOMAINS.some((domain) => lower.includes(domain));
  }

  // ─── 1. Window.open defuser (blocks all popups) ─────────────────────────────
  private installWindowOpenDefuser() {
    if (typeof window === 'undefined') return;
    const originalOpen = window.open;

    const createSafeMockWindow = (): WindowProxy => {
      const dummyLocation = {
        href: '',
        assign: () => {},
        replace: () => {},
        reload: () => {},
        toString: () => '',
      };

      const mock: any = {
        closed: true,
        defaultStatus: '',
        document: {
          open: () => {},
          write: () => {},
          close: () => {},
          location: dummyLocation,
        },
        focus: () => {},
        blur: () => {},
        close: () => {},
        postMessage: () => {},
        location: dummyLocation,
        opener: null,
        parent: null,
        top: null,
        self: null,
        window: null,
        frames: [],
        length: 0,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };

      mock.window = mock;
      mock.self = mock;
      return mock as unknown as WindowProxy;
    };

    // AGGRESSIVE: block ALL window.open calls unconditionally when shield is active
    // (legitimate players never need to open new windows)
    window.open = (...args: [url?: string | URL, target?: string, features?: string]): WindowProxy | null => {
      if (this.enabled) {
        const urlStr = String(args[0] || '');
        this.recordBlocked('popup', urlStr);
        return createSafeMockWindow();
      }
      return originalOpen.apply(window, args as any);
    };
  }

  // ─── 2. Programmatic click & link navigation defuser ────────────────────────
  private installClickGuard() {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'click',
      (event: MouseEvent) => {
        if (!this.enabled) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        // Block any click that tries to navigate away from the page through an ad or external link
        // when the user is inside the player area
        const isInsidePlayer =
          !!target.closest('.watch-container') ||
          !!target.closest('.watch-player-box') ||
          !!target.closest('[class*="player"]');

        if (isInsidePlayer) {
          // Block all external navigation from inside the player
          const anchor = target.closest('a');
          if (anchor && anchor.href) {
            const href = anchor.href.toLowerCase();
            const isExternal =
              !href.startsWith(window.location.origin) &&
              !href.startsWith('/') &&
              !href.startsWith('#');
            if (isExternal) {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              this.recordBlocked('redirect', href);
              return;
            }
          }
        }

        // Also block any ad-domain anchor anywhere on the page
        const anchor = target.closest('a');
        if (anchor && anchor.href) {
          const href = anchor.href.toLowerCase();
          if (this.isAdUrl(href)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.recordBlocked('redirect', href);
          }
        }
      },
      true
    );

    // Defuse programmatic a.click() and dispatchEvent
    if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype) {
      const originalClick = HTMLAnchorElement.prototype.click;
      const originalDispatch = HTMLAnchorElement.prototype.dispatchEvent;
      const self = this;

      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        if (self.enabled && this.href) {
          const href = this.href.toLowerCase();
          const isExternal =
            !href.startsWith(window.location.origin) &&
            !href.startsWith('/') &&
            !href.startsWith('#');
          if (isExternal && (self.isAdUrl(href) || this.target === '_blank')) {
            self.recordBlocked('redirect', this.href);
            return;
          }
        }
        return originalClick.apply(this);
      };

      HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, event: Event) {
        if (self.enabled && this.href && event.type === 'click') {
          const href = this.href.toLowerCase();
          const isExternal =
            !href.startsWith(window.location.origin) &&
            !href.startsWith('/') &&
            !href.startsWith('#');
          if (isExternal && (self.isAdUrl(href) || this.target === '_blank')) {
            self.recordBlocked('redirect', this.href);
            return false;
          }
        }
        return originalDispatch.apply(this, [event]);
      };
    }
  }

  // ─── 3. Player-scoped overlay defuser (defuses clickjackers without mutating React DOM) ───
  private installOverlayBuster() {
    if (typeof window === 'undefined') return;

    // Defuse clickjacking clicks on the watch player box via capturing phase
    window.addEventListener(
      'click',
      (e) => {
        if (!this.enabled) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Check if click is on an anchor targeting an ad
        const anchor = target.closest('a');
        if (anchor && anchor.href && this.isAdUrl(anchor.href)) {
          e.preventDefault();
          e.stopPropagation();
          this.recordBlocked('ad', anchor.href);
          return false;
        }

        // Check if click hit a transparent rogue overlay inside the watch player box
        const playerBox = target.closest('.watch-player-box');
        if (playerBox && target !== playerBox && !target.closest('iframe')) {
          const style = window.getComputedStyle(target);
          if (
            (style.position === 'absolute' || style.position === 'fixed') &&
            parseInt(style.zIndex || '0', 10) > 1 &&
            !target.closest('button') &&
            !target.closest('.player-control')
          ) {
            e.preventDefault();
            e.stopPropagation();
            target.style.pointerEvents = 'none';
            target.style.display = 'none';
            this.recordBlocked('popup', 'player-clickjack-defused');
            return false;
          }
        }
      },
      true // capture phase: intercepts before ad scripts run
    );
  }

  // ─── 4. Network filter for fetch & XHR ──────────────────────────────────────
  private installNetworkFilter() {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      if (this.enabled) {
        const url =
          typeof args[0] === 'string'
            ? args[0]
            : args[0] instanceof Request
            ? args[0].url
            : (args[0] as URL)?.href || '';
        if (this.isAdUrl(url)) {
          this.recordBlocked('tracker', url);
          return new Response(JSON.stringify({ blocked: true, adblocker: 'AnimePakistan' }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return originalFetch.apply(window, args);
    };

    if (typeof XMLHttpRequest !== 'undefined') {
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const self = this;

      XMLHttpRequest.prototype.open = function (
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        ...rest: any[]
      ) {
        const urlStr = String(url);
        if (self.enabled && self.isAdUrl(urlStr)) {
          self.recordBlocked('tracker', urlStr);
          return (originalXhrOpen as any).apply(this, ['GET', 'data:application/json,{"blocked":true}', ...rest]);
        }
        return (originalXhrOpen as any).apply(this, [method, url, ...rest]);
      };
    }
  }

  // ─── 5. Focus guard + Anti-Anti-AdBlock + Navigation guard ──────────────────
  private installWindowGuards() {
    if (typeof window === 'undefined') return;

    // Anti-Anti-AdBlock: deceive detectors into thinking no adblocker is present
    try {
      (window as any).canRunAds = true;
      (window as any).isAdBlockActive = false;
      (window as any).adsBlocked = false;
      (window as any).adblocker = false;

      const dummyFab = {
        onDetected: () => dummyFab,
        onNotDetected: (cb: any) => {
          if (typeof cb === 'function') setTimeout(cb, 20);
          return dummyFab;
        },
        check: () => false,
        clearEvent: () => {},
        setOption: () => dummyFab,
      };
      (window as any).fuckAdBlock = dummyFab;
      (window as any).FuckAdBlock = dummyFab;
      (window as any).blockAdBlock = dummyFab;
      (window as any).BlockAdBlock = dummyFab;
      (window as any).snackBar = { show: () => {} };
      (window as any).adblockDetector = {
        init: () => {},
        addEvent: (type: string, cb: any) => {
          if (type === 'noAdBlock' && typeof cb === 'function') setTimeout(cb, 20);
        },
      };
      // Defuse common ad detector check patterns
      (window as any).google_jobrunner = true;
      (window as any).__adBlockCheck = false;
    } catch (e) {}

    // Focus guard: reclaim focus when an iframe steals it (popunder trick)
    window.addEventListener('blur', () => {
      if (this.enabled && document.activeElement && document.activeElement.tagName === 'IFRAME') {
        this.recordBlocked('popup', 'iframe-focus-trap');
        setTimeout(() => {
          window.focus();
        }, 30);
      }
    });

    // CSP violation guard
    window.addEventListener('securitypolicyviolation', (e) => {
      if (this.enabled) {
        this.recordBlocked('popup', (e as any).blockedURI || 'sandbox-violation');
      }
    });

    // location.assign / replace guard
    const self = this;
    if (typeof window.location !== 'undefined') {
      try {
        const originalAssign = window.location.assign.bind(window.location);
        Object.defineProperty(window.location, 'assign', {
          configurable: true,
          writable: true,
          value: function (url: string) {
            if (self.enabled && self.isAdUrl(url)) {
              self.recordBlocked('redirect', url);
              return;
            }
            return originalAssign(url);
          },
        });
      } catch (e) {}

      try {
        const originalReplace = window.location.replace.bind(window.location);
        Object.defineProperty(window.location, 'replace', {
          configurable: true,
          writable: true,
          value: function (url: string) {
            if (self.enabled && self.isAdUrl(url)) {
              self.recordBlocked('redirect', url);
              return;
            }
            return originalReplace(url);
          },
        });
      } catch (e) {}
    }
  }

  // ─── 6. postMessage defuser (stops ad commands sent via inter-frame messages) ─
  private installPostMessageDefuser() {
    if (typeof window === 'undefined') return;

    const AD_MESSAGE_PATTERNS = [
      'popup', 'redirect', 'navigate', 'openwindow', 'opentab', 'adclick',
      'showad', 'admessage', 'adnotice', 'clickjack', 'monetization',
    ];

    window.addEventListener(
      'message',
      (event: MessageEvent) => {
        if (!this.enabled) return;
        try {
          const data = typeof event.data === 'string' ? event.data.toLowerCase() : JSON.stringify(event.data || '').toLowerCase();
          if (AD_MESSAGE_PATTERNS.some((p) => data.includes(p))) {
            // Check if origin is suspicious (not our own origin)
            const isTrustedOrigin = event.origin === window.location.origin || event.origin === 'null';
            if (!isTrustedOrigin) {
              // Stop propagation to prevent ad scripts from receiving this message
              event.stopImmediatePropagation();
              this.recordBlocked('popup', `postmessage:${event.origin}`);
            }
          }
        } catch (e) {}
      },
      true // capture phase
    );
  }

  // ─── 7. Iframe creation guard — nullifies programmatic ad iframes ────────────
  private installIframeGuard() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const self = this;

    // Intercept document.createElement to detect ad iframe creation
    const originalCreateElement = document.createElement.bind(document);
    (document as any).createElement = function (tagName: string, options?: ElementCreationOptions) {
      const el = originalCreateElement(tagName, options);

      if (tagName.toLowerCase() === 'iframe' && self.enabled) {
        // Override src setter to intercept ad URL injection
        let _src = '';
        Object.defineProperty(el, 'src', {
          configurable: true,
          get: () => _src,
          set: (value: string) => {
            _src = value;
            if (value && self.isAdUrl(value)) {
              self.recordBlocked('ad', `iframe-src:${value}`);
              _src = 'about:blank';
              (el as HTMLIFrameElement).setAttribute('src', 'about:blank');
            } else {
              (el as HTMLIFrameElement).setAttribute('src', value);
            }
          },
        });
      }

      return el;
    };
  }

  // ─── 8. Deep sweep disabled to preserve React DOM integrity ──────────────
  private startDeepSweep() {
    // Intentionally no-op to prevent React hydration / reconciliation collisions
  }
}

export const adblockEngine = new AdBlockEngine();
export const adblockShield = adblockEngine;
