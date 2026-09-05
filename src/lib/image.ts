export function getProxiedImageUrl(url?: string, type: 'poster' | 'backdrop' = 'poster'): string {
  if (!url) return '';
  
  let cleanUrl = url.startsWith('//') ? 'https:' + url : url;
  cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');

  if (cleanUrl.includes('image.tmdb.org/t/p/')) {
    if (type === 'poster') {
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|500)\//i, '/t/p/w342/');
    } else {
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|342)\//i, '/t/p/w780/');
    }
  }

  return cleanUrl;
}

