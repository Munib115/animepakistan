export function getProxiedImageUrl(url?: string, type: 'poster' | 'backdrop' = 'poster'): string {
  if (!url) return '';
  
  let cleanUrl = url.startsWith('//') ? 'https:' + url : url;
  cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');

  if (cleanUrl.includes('image.tmdb.org/t/p/')) {
    if (type === 'poster') {
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|342)\//i, '/t/p/w500/');
    } else {
      cleanUrl = cleanUrl.replace(/\/t\/p\/w(92|154|185|342|500|780)\//i, '/t/p/w1280/');
    }
  }

  return cleanUrl;
}

