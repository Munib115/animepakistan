// Universal Web Share API & Clipboard Copy Helper for Anime & Specific Episodes

export async function shareContent(data: {
  title: string;
  text?: string;
  url: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof window === 'undefined') return 'failed';

  const shareUrl = data.url.startsWith('http')
    ? data.url
    : `${window.location.origin}${data.url.startsWith('/') ? '' : '/'}${data.url}`;

  const shareTitle = data.title || 'Anime Pakistan';
  const shareText = data.text || `${shareTitle} - Urdu & Hindi Dubbed Anime in Pakistan`;

  // 1. Try native mobile / desktop Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return 'shared';
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return 'failed'; // User cancelled the native share sheet
      }
      // If native share threw an error (e.g. permission/unsupported format), fallback to copy
    }
  }

  // 2. Clipboard API fallback
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return 'copied';
    }
  } catch (e) {}

  // 3. Document execCommand fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = shareUrl;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return 'copied';
  } catch (e) {
    return 'failed';
  }
}
