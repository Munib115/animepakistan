// Advanced High-Performance AdBlocker Engine for AnimePakistan
// Sourced from open-source adblocking architectures (uBlock Origin & Ghostery scriptlet defusers)
// Shields video playback from popups, clickjacking, rogue redirects, and ad trackers

export interface AdBlockStats {
  adsBlocked: number;
  popupsBlocked: number;
  trackersBlocked: number;
  bandwidthSavedMB: number;
  timeSavedSec: number;
}

// Backwards-compatible alias
export type ShieldStats = AdBlockStats;

const INITIAL_STATS: AdBlockStats = {
  adsBlocked: 0,
  popupsBlocked: 0,
  trackersBlocked: 0,
  bandwidthSavedMB: 0,
  timeSavedSec: 0,
};

// Comprehensive list of known video-streaming ad networks, popunders, clickjackers, and trackers
// (Compiled from EasyList, Peter Lowe's list, and AdGuard mobile/video rules)
const BLOCKED_DOMAINS = [
  // Popunder & Clickjack Networks
  'popads', 'popcash', 'propellerads', 'monetag', 'onclickunder', 'adsterra',
  'clickadu', 'galaksion', 'ezmob', 'hilltopads', 'richpush', 'admaven', 'ad-maven',
  'adcash', 'yllix', 'mondiad', 'adoperator', 'short.icu', 'streamtape-ads',
  'zeroredirect', 'syndication', 'trafficstars', 'trafficjunky', 'trafficforce',
  'exoclick', 'juicyads', 'plugrush', 'ero-advertising', 'bidvertiser',

  // Rogue Redirects & Gambling/Spam
  '1xbet', 'bet365', 'betway', 'parimatch', 'melbet', 'mostbet', 'linebet',
  'dafabet', 'vulkan', 'slot', 'casino', 'poker', 'bonus-free',

  // Programmatic Ad Exchanges & Video Ad Injections
  'doubleclick', 'googleadservices', 'adnxs', 'appnexus', 'smartadserver',
  'rubiconproject', 'criteo', 'pubmatic', 'openx', 'adroll', 'adthrive',
  'mediavine', 'vidoomy', 'revcontent', 'mgid', 'infolinks', 'outbrain',
  'taboola', 'adtrue', 'yadro', 'adkeeper', 'tsyndicate', 'adsupply',
  'adform', 'adkernel', 'adreactor', 'casalemedia', 'gumgum', 'improvedigital',
  'lijit', 'liveintent', 'mathtag', 'media.net', 'nativeads', 'sovrn',
  'spotxchange', 'teads', 'tremorhub', 'triplelift', 'undertone', 'yieldmo',

  // Trackers & Telemetry Beacons
  'scorecardresearch', 'quantserve', 'whos.amung.us', 'histats', 'statcounter',
  'coinhive', 'crypto-loot'
];

class AdBlockEngine {
  private enabled: boolean = true;
  private stats: AdBlockStats = { ...INITIAL_STATS };
  private initialized: boolean = false;

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
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        // Sanitize legacy fake dummy stats (previously set to 14 ads, 8 popups)
        if (parsed.adsBlocked === 14 && parsed.popupsBlocked === 8) {
          this.stats = { ...INITIAL_STATS };
          localStorage.setItem('ap_adblock_stats', JSON.stringify(this.stats));
        } else {
          this.stats = {
            adsBlocked: Number(parsed.adsBlocked) || 0,
            popupsBlocked: Number(parsed.popupsBlocked) || 0,
            trackersBlocked: Number(parsed.trackersBlocked) || 0,
            bandwidthSavedMB: Number(parsed.bandwidthSavedMB) || 0,
            timeSavedSec: Number(parsed.timeSavedSec) || 0,
          };
        }
      } else {
        localStorage.setItem('ap_adblock_stats', JSON.stringify(INITIAL_STATS));
      }
    } catch (e) {
      this.stats = { ...INITIAL_STATS };
    }

    // 2. Install uBlock-style Safe WindowProxy popup defuser
    this.installWindowOpenDefuser();

    // 3. Install programmatic click & redirect defuser
    this.installClickGuard();

    // 4. Install DOM MutationObserver overlay-buster
    this.installOverlayBuster();

    // 5. Install Network Request filter for fetch & XHR
    this.installNetworkFilter();
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ap_adblock_stats', JSON.stringify(this.stats));
        window.dispatchEvent(new CustomEvent('ap_adblock_stats_updated', { detail: this.stats }));
      } catch (e) {}
    }
  }

  public recordBlocked(type: 'popup' | 'ad' | 'tracker' | 'redirect', targetUrl?: string) {
    if (!this.enabled) return;

    if (type === 'popup' || type === 'redirect') {
      this.stats.popupsBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.5).toFixed(1));
    } else if (type === 'tracker') {
      this.stats.trackersBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.1).toFixed(1));
    } else {
      this.stats.adsBlocked += 1;
      this.stats.timeSavedSec = Number((this.stats.timeSavedSec + 0.3).toFixed(1));
    }

    this.stats.bandwidthSavedMB = Number((this.stats.bandwidthSavedMB + 0.18).toFixed(2));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ap_adblock_stats', JSON.stringify(this.stats));
        window.dispatchEvent(new CustomEvent('ap_adblock_stats_updated', { detail: this.stats }));
      } catch (e) {}
    }
  }

  public isAdUrl(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return BLOCKED_DOMAINS.some((domain) => lower.includes(domain));
  }

  // 1. uBlock Origin WindowProxy defuser
  // Returns a compliant mock WindowProxy object so rogue scripts calling w.focus() or w.close() do not crash the player
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

      const mock = {
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

      mock.window = mock as any;
      mock.self = mock as any;
      return mock as unknown as WindowProxy;
    };

    window.open = (...args: [url?: string | URL, target?: string, features?: string]): WindowProxy | null => {
      if (this.enabled) {
        const urlStr = String(args[0] || '');
        this.recordBlocked('popup', urlStr);
        // Defuse popup cleanly without throwing exceptions in third-party scripts
        return createSafeMockWindow();
      }
      return originalOpen.apply(window, args as any);
    };
  }

  // 2. Programmatic click & link navigation defuser
  private installClickGuard() {
    if (typeof window === 'undefined') return;

    // A. Intercept manual user clicks in capture phase before rogue listeners trigger
    window.addEventListener(
      'click',
      (event: MouseEvent) => {
        if (!this.enabled) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        // Check if user clicked an anchor pointing to known ad/redirect domain
        const anchor = target.closest('a');
        if (anchor && anchor.href) {
          const href = anchor.href.toLowerCase();
          const isExternal = !href.startsWith(window.location.origin) && !href.startsWith('/') && !href.startsWith('#');

          if (isExternal && this.isAdUrl(href)) {
            event.preventDefault();
            event.stopPropagation();
            this.recordBlocked('redirect', href);
            return;
          }
        }
      },
      true
    );

    // B. Defuse programmatic HTMLAnchorElement.prototype.click() redirects
    if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype) {
      const originalClick = HTMLAnchorElement.prototype.click;
      const self = this;

      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        if (self.enabled && this.href && self.isAdUrl(this.href)) {
          self.recordBlocked('redirect', this.href);
          return;
        }
        return originalClick.apply(this);
      };
    }
  }

  // 3. MutationObserver overlay-buster (removes transparent clickjacking overlays)
  private installOverlayBuster() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    const checkAndNeutralizeNode = (node: Node) => {
      if (!this.enabled || !(node instanceof HTMLElement)) return;

      // Ignore legitimate UI elements of the application
      if (
        node.closest('.quick-control-hub') ||
        node.closest('.quick-hub-popover') ||
        node.closest('.quick-hub-backdrop') ||
        node.closest('header') ||
        node.closest('nav')
      ) {
        return;
      }

      // Check for invisible/transparent full-viewport clickjack divs
      const style = window.getComputedStyle(node);
      const isFixed = style.position === 'fixed' || style.position === 'absolute';
      const zIndex = parseInt(style.zIndex, 10);
      const highZIndex = !isNaN(zIndex) && zIndex >= 999;

      if (isFixed && highZIndex) {
        const opacity = parseFloat(style.opacity);
        const isTransparent = isNaN(opacity) || opacity <= 0.05 || style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)';
        const width = node.offsetWidth || parseInt(style.width, 10) || 0;
        const height = node.offsetHeight || parseInt(style.height, 10) || 0;
        const coversScreen = width >= window.innerWidth * 0.7 && height >= window.innerHeight * 0.7;

        if (coversScreen && isTransparent) {
          try {
            node.remove();
            this.recordBlocked('ad', 'clickjack-overlay');
          } catch (e) {}
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(checkAndNeutralizeNode);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // 4. Network filter for fetch & XMLHttpRequest
  private installNetworkFilter() {
    if (typeof window === 'undefined') return;

    // A. Intercept window.fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      if (this.enabled) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : (args[0] as URL)?.href || '');
        if (this.isAdUrl(url)) {
          this.recordBlocked('tracker', url);
          // Return simulated clean empty response
          return new Response(JSON.stringify({ blocked: true, adblocker: 'AnimePakistan' }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return originalFetch.apply(window, args);
    };

    // B. Intercept XMLHttpRequest
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
}

export const adblockEngine = new AdBlockEngine();
// Alias export for backwards compatibility
export const adblockShield = adblockEngine;
