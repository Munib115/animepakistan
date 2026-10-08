export interface StreamSource {
  label: string;
  url: string;
  isMultiAudio: boolean;
  directApiStream?: string;
}

/** Normalize any legacy CDN or protocol issues and convert legacy shorteners to direct players */
export function sanitizeStreamUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('/')) return url.trim();
  let clean = url
    .replace(/^http:\/\//i, 'https://')
    .replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx')
    .trim();

  // Convert legacy short.icu links directly into working abyssplayer embeds
  if (clean.includes('short.icu/')) {
    clean = clean.replace(/https?:\/\/short\.icu\/([a-zA-Z0-9_\-]+)/gi, 'https://player.abyssplayer.com/$1');
  }

  // Convert TeraBox share link to embed player
  if (clean.includes('terabox.com/s/') || clean.includes('1024terabox.com/s/') || clean.includes('1024tera.com/sharing/link?surl=')) {
    const m = clean.match(/(?:s\/1?|surl=)([a-zA-Z0-9_\-]+)/i);
    if (m && m[1]) {
      clean = `https://www.terabox.app/sharing/embed?surl=${m[1].replace(/^1/, '')}`;
    }
  }

  return clean;
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

/** Unpack AnimeSalt plyr / multi-lang player base64 data parameter into individual clean language streams */
export function unpackAnimeSaltDataUrl(url: string): StreamSource[] {
  if (!url || typeof url !== 'string') return [];
  if (!url.includes('data=') || (!url.includes('plyr') && !url.includes('player') && !url.includes('animesalt'))) {
    return [];
  }
  try {
    const urlObj = new URL(url);
    const dataParam = urlObj.searchParams.get('data');
    if (!dataParam) return [];
    const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
    const parsed = JSON.parse(decodedStr);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const results: StreamSource[] = [];
    for (const item of parsed) {
      if (!item || !item.link) continue;
      const clean = sanitizeStreamUrl(item.link);
      if (clean && isValidStreamEmbedUrl(clean)) {
        results.push({
          label: `Abyss (${item.language || 'HD'})`,
          url: clean,
          isMultiAudio: true,
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

/** Check if a URL is a legitimate video player embed and NOT a full website webpage or dead shortener */
export function isValidStreamEmbedUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();

  // Allow internal local streaming API, Supabase Storage streams, and direct videos
  if (
    lower.startsWith('/api/stream/local-video') ||
    lower.startsWith('/api/stream/supabase-movie') ||
    lower.startsWith('/videos/') ||
    lower.includes('supabase.co/storage/v1/object/') ||
    lower.includes('terabox') ||
    lower.includes('1024tera')
  ) {
    return true;
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;

  // Reject malformed host strings from legacy regex scrapers
  if (
    lower.includes('://sd.') ||
    lower.includes('://hd.') ||
    lower.includes('blakiteapi1xyz') ||
    lower.includes('sd,gdmirrorbot')
  ) {
    return false;
  }

  // NEVER embed dead shorteners or broken shortener proxies
  if (
    lower.includes('short.icu') ||
    lower.includes('short.link') ||
    lower.includes('shortener') ||
    lower.includes('linkvertise')
  ) {
    return false;
  }

  // NEVER embed dead hosts verified to return Error 522, ENOTFOUND, or 404
  if (
    lower.includes('raretoonsindia.co') ||
    lower.includes('emturbovid.com') ||
    lower.includes('emturbovid.dev') ||
    lower.includes('rubystm.com') ||
    lower.includes('stmruby.com') ||
    lower.includes('rubyvid.com') ||
    lower.includes('streamruby.com') ||
    lower.includes('multimovies.cloud') ||
    lower.includes('streamsb.net') ||
    lower.includes('sstreamsb.net') ||
    lower.includes('sttreamsb.net') ||
    lower.includes('sytramsb.net') ||
    lower.includes('watchsb.com') ||
    lower.includes('bullstream.xyz') ||
    lower.includes('vidxstream.xyz') ||
    lower.includes('fhdgdmirrorbot.nl') ||
    lower.includes('gdmirrorbot.nl') ||
    lower.includes('deaddrive.icu') ||
    (lower.includes('as-cdn') && lower.includes('.top')) ||
    lower.includes('streamhide.')
  ) {
    return false;
  }

  // NEVER embed third-party website pages or SAMEORIGIN playonline wrappers inside the video player
  if (
    lower.includes('playonline.php') ||
    lower.includes('hindianimeszone.com') ||
    lower.includes('animesalt.cx/episode') ||
    lower.includes('animesalt.cx/series') ||
    lower.includes('animesalt.cx/movies') ||
    lower.includes('animesalt.cx/tv') ||
    (lower.includes('animesalt.cx') && !lower.includes('player') && !lower.includes('plyr'))
  ) {
    return false;
  }

  // ALLOW AnimeSalt multi-language player wrappers
  if (
    (lower.includes('data=') && (lower.includes('plyr') || lower.includes('player') || lower.includes('animesalt'))) ||
    lower.includes('as-cdn/clone/')
  ) {
    return true;
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


