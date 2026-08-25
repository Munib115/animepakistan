import { NextRequest, NextResponse } from 'next/server';

function resolveUrl(baseUrl: string, relativePath: string): string {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const urlObj = new URL(baseUrl);
  if (relativePath.startsWith('/')) {
    // Relative to origin root (e.g. /hls/...)
    return urlObj.origin + relativePath;
  } else {
    // Relative to current directory
    const dir = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
    return dir + relativePath;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const m3u8Url = searchParams.get('url');

  if (!m3u8Url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // 1. Fetch m3u8 playlist contents
    const res = await fetch(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://as-cdn26.top/'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch playlist (status ${res.status})` }, { status: res.status });
    }

    const playlistText = await res.text();
    const lines = playlistText.split('\n');
    let segmentUrls: string[] = [];

    // Check if it's a master playlist containing sub-playlists (resolutions)
    let hasSubPlaylists = false;
    let bestSubPlaylistPath = '';
    let maxBandwidth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        hasSubPlaylists = true;
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
        
        let nextLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j].trim();
          if (l && !l.startsWith('#')) {
            nextLine = l;
            break;
          }
        }

        if (nextLine && bandwidth > maxBandwidth) {
          maxBandwidth = bandwidth;
          bestSubPlaylistPath = nextLine;
        }
      }
    }

    let targetPlaylistText = playlistText;
    let targetBaseUrl = m3u8Url;

    if (hasSubPlaylists && bestSubPlaylistPath) {
      const resolvedSubUrl = resolveUrl(m3u8Url, bestSubPlaylistPath);
      console.log('[Sync Downloader] Fetching sub-playlist:', resolvedSubUrl);
      
      const subRes = await fetch(resolvedSubUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://as-cdn26.top/'
        }
      });
      if (subRes.ok) {
        targetPlaylistText = await subRes.text();
        targetBaseUrl = resolvedSubUrl;
      }
    }

    // Parse target playlist segments
    const targetLines = targetPlaylistText.split('\n');
    for (const line of targetLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const fullUrl = resolveUrl(targetBaseUrl, trimmed);
        segmentUrls.push(fullUrl);
      }
    }

    return NextResponse.json({ segments: segmentUrls });
  } catch (err: any) {
    console.error('Failed to parse HLS segments:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
