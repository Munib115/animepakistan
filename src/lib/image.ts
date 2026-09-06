export function getProxiedImageUrl(url?: string, type: 'poster' | 'backdrop' | 'hero' = 'poster'): string {
  if (!url) return '';
  
  let cleanUrl = url.startsWith('//') ? 'https:' + url : url;
  cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');

  if (cleanUrl.includes('image.tmdb.org/t/p/')) {
    if (type === 'poster') {
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|500)\//i, '/t/p/w342/');
    } else if (type === 'hero') {
      // Pristine ultra-high-definition original master quality for Hero slider
      cleanUrl = cleanUrl.replace(/\/t\/p\/(w\d+|original)\//i, '/t/p/original/');
    } else {
      // High-resolution 1080p backdrop
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|342)\//i, '/t/p/w1280/');
    }
  }

  return cleanUrl;
}
