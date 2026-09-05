export interface StreamSource {
  label: string;
  url: string;
  isMultiAudio: boolean;
}

/** Normalize any legacy CDN or protocol issues */
export function sanitizeStreamUrl(url: string): string {
  if (!url) return '';
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx')
    .trim();
}

/** Decode HTML entities like &quot; &#39; &amp; */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

/** Check if a URL is a legitimate video player embed and NOT a full website webpage */
export function isValidStreamEmbedUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;

  // NEVER embed third-party website pages inside the video player
  if (
    lower.includes('animesalt.cx/episode') ||
    lower.includes('animesalt.cx/series') ||
    lower.includes('animesalt.cx/movies') ||
    lower.includes('animesalt.cx/tv') ||
    (lower.includes('animesalt.cx') && !lower.includes('player.php'))
  ) {
    return false;
  }

  // Block ad/tracking/garbage URLs
  if (
    lower.startsWith('about:blank') ||
    lower.includes('google') ||
    lower.includes('doubleclick') ||
    lower.includes('disqus') ||
    lower.includes('facebook') ||
    lower.includes('youtube.com/embed')
  ) {
    return false;
  }

  return true;
}

