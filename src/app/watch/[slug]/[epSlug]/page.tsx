import Header from '@/components/Header';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import WatchContainer from '@/components/WatchContainer';
import { StreamSource, sanitizeStreamUrl } from '@/lib/resolver';
import { resolveStreamSources } from '@/lib/resolver-server';
import { getAnimeDb } from '@/lib/db';

interface PageProps {
  params: Promise<{ slug: string; epSlug: string }>;
}

export const metadata: Metadata = {
  title: 'Watch Episode',
  robots: { index: false, follow: true },
};

export default async function EpisodeWatchPage(props: PageProps) {
  const { slug, epSlug } = await props.params;

  // Load database from in-memory cache
  const items = getAnimeDb();

  // Find series
  const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();
  const anime = items.find((item) => {
    const itemSlug = item.slug.toLowerCase().trim();
    return (itemSlug === decodedSlug || itemSlug === decodedSlug.replace(/\/$/, '')) && item.type === 'series';
  });

  if (!anime) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <Header />
        <main className="container" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
          <div className="glass-panel" style={{ padding: '40px 24px', textAlign: 'center', maxWidth: '480px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '16px' }}>
              warning
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Series Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              We could not find the requested anime series in our database.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Find episode or construct fallback
  const decodedEpSlug = decodeURIComponent(epSlug).toLowerCase().trim();
  const episode = anime.episodes?.find((ep) => {
    const epSlugClean = ep.slug.toLowerCase().trim();
    return epSlugClean === decodedEpSlug || epSlugClean === decodedEpSlug.replace(/\/$/, '');
  }) || {
    number: 1,
    title: decodedEpSlug.replace(/-/g, ' ').toUpperCase(),
    slug: decodedEpSlug,
    url: `/watch/${slug}/${decodedEpSlug}`,
    thumbnail: anime.poster || '',
  };

  // Resolve streams with priority:
  // 1. Pre-cached streamUrl on the episode object
  // 2. New animesalt-stream API (saltSlug + episode number)
  // 3. General resolver (legacy fallback)
  let sources: StreamSource[] = [];

  if ((episode as any).streamUrl) {
    const streamUrl = (episode as any).streamUrl;
    if (streamUrl.includes('multi-lang-plyr/player.php?data=')) {
      try {
        const urlObj = new URL(streamUrl);
        const dataParam = urlObj.searchParams.get('data');
        if (dataParam) {
          const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
          const parsed = JSON.parse(decodedStr);
          if (Array.isArray(parsed)) {
            sources = parsed.map((item: any) => ({
              label: `Abyss (${item.language || 'HD'})`,
              url: sanitizeStreamUrl(item.link),
              isMultiAudio: false
            }));
          }
        }
      } catch (e) {
        sources = [{ label: 'HD-1 (Hindi)', url: streamUrl, isMultiAudio: true }];
      }
    } else {
      sources = [{ label: 'HD-1 (Hindi)', url: streamUrl, isMultiAudio: true }];
    }
  }

  if (sources.length === 0) {
    const saltSlug = (anime as any).saltSlug || anime.slug;
    const epNumber = episode.number || 1;

    // Try the new animesalt-stream route first (scrapes triggerEpisode data)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const streamRes = await fetch(
        `${baseUrl}/api/animesalt-stream?slug=${encodeURIComponent(saltSlug)}&ep=${epNumber}`,
        { next: { revalidate: 1800 } }
      );
      if (streamRes.ok) {
        const data = await streamRes.json();
        if (data.sources && data.sources.length > 0) {
          sources = data.sources;
        }
      }
    } catch (e) {}

    // Fall back to general resolver
    if (sources.length === 0) {
      sources = await resolveStreamSources(
        `https://animesalt.cx/series/${saltSlug}/`,
        epNumber
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      <div className="hero-glow" />
      <Header />
      <main className="container" style={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
        <WatchContainer anime={anime} currentEpisode={episode} sources={sources} />
      </main>
      <Footer />
    </div>
  );
}
