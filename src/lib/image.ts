export function getProxiedImageUrl(url?: string): string {
  if (!url) return '';
  
  const cleanUrl = url.startsWith('//') ? 'https:' + url : url;
  return cleanUrl.replace(/^http:\/\//i, 'https://');
}

