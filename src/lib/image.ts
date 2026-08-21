export function getProxiedImageUrl(url?: string): string {
  if (!url) return '';
  
  const cleanUrl = url.startsWith('//') ? 'https:' + url : url;

  // TMDb images are globally accessible on high speed CDN
  if (cleanUrl.includes('image.tmdb.org')) {
    return cleanUrl;
  }

  // AnimeSalt and AniList CDN images might have ISP or referrer restrictions: route through local proxy
  if (cleanUrl.includes('animesalt.link') || cleanUrl.includes('anilist.co')) {
    return `/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`;
  }

  return cleanUrl;
}
