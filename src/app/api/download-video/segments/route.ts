import { NextRequest, NextResponse } from 'next/server';

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
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    // Check if it's a master playlist containing sub-playlists (resolutions)
    let hasSubPlaylists = false;
    let bestSubPlaylistUrl = '';
    let maxBandwidth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        hasSubPlaylists = true;
        // Parse BANDWIDTH
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
        
        // The URL is on the next line
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
          bestSubPlaylistUrl = nextLine.startsWith('http') ? nextLine : baseUrl + nextLine;
        }
      }
    }

    let targetPlaylistText = playlistText;
    let targetBaseUrl = baseUrl;

    if (hasSubPlaylists && bestSubPlaylistUrl) {
      console.log('Fetching best quality sub-playlist:', bestSubPlaylistUrl);
      const subRes = await fetch(bestSubPlaylistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://as-cdn26.top/'
        }
      });
      if (subRes.ok) {
        targetPlaylistText = await subRes.text();
        targetBaseUrl = bestSubPlaylistUrl.substring(0, bestSubPlaylistUrl.lastIndexOf('/') + 1);
      }
    }

    // Parse target playlist segments
    const targetLines = targetPlaylistText.split('\n');
    for (const line of targetLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const fullUrl = trimmed.startsWith('http') ? trimmed : targetBaseUrl + trimmed;
        segmentUrls.push(fullUrl);
      }
    }

    return NextResponse.json({ segments: segmentUrls });
  } catch (err: any) {
    console.error('Failed to parse HLS segments:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
