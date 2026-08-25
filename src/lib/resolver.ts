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
