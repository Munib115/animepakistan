/**
 * Cloudflare Worker: Anime Pakistan Video Stream Proxy
 * Bypasses Cloudflare hotlink protection, CORS, and Referrer restrictions
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight options
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // Extract target video URL from query param: ?url=https://as-cdn21.top/video/...
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ status: 'Anime Pakistan Video Proxy Active' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      // Clean target
      const decodedTarget = decodeURIComponent(targetUrl);

      // Fetch upstream video page/stream with spoofed legitimate headers
      const upstreamResponse = await fetch(decodedTarget, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.link/',
          'Origin': 'https://animesalt.link',
          'Accept': '*/*',
        },
      });

      // Clone headers and add CORS headers
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.delete('x-frame-options');
      responseHeaders.delete('content-security-policy');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response('Proxy Stream Error: ' + err.message, { status: 502 });
    }
  },
};
