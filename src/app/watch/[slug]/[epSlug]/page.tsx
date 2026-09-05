import Header from '@/components/Header';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import WatchContainer from '@/components/WatchContainer';
import { redirect } from 'next/navigation';
import { StreamSource, sanitizeStreamUrl, isValidStreamEmbedUrl } from '@/lib/resolver';
import { resolveStreamSources } from '@/lib/resolver-server';
import { getAnimeDb } from '@/lib/db';

interface PageProps {
  params: Promise<{ slug: string; epSlug: string }>;
}

export const maxDuration = 30;

export const metadata: Metadata = {
  title: 'Watch Episode',
  robots: { index: false, follow: true },
};

export default async function EpisodeWatchPage(props: PageProps) {
  const { slug, epSlug } = await props.params;

  // Load database from in-memory cache
  const items = getAnimeDb();

  // Find series with flexible slug matching
  const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();
  const anime = items.find((item) => {
    const itemSlug = item.slug.toLowerCase().trim();
    const saltSlug = item.saltSlug?.toLowerCase().trim();
    return (
      itemSlug === decodedSlug ||
      itemSlug === decodedSlug.replace(/\/$/, '') ||
      saltSlug === decodedSlug ||
      item.url?.includes(`/${decodedSlug}/`)
    ) && item.type === 'series';
  });

  if (!anime) {
    // Check if this slug is actually a movie, and redirect to movie watch page!
    const movie = items.find((item) => {
      const itemSlug = item.slug.toLowerCase().trim();
      const saltSlug = item.saltSlug?.toLowerCase().trim();
      return (
        itemSlug === decodedSlug ||
        itemSlug === decodedSlug.replace(/\/$/, '') ||
        saltSlug === decodedSlug ||
        item.url?.includes(`/${decodedSlug}/`)
      ) && item.type === 'movie';
    });

    if (movie) {
      redirect(`/watch/${movie.slug}`);
    }

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
            sources = parsed
              .filter((item: any) => item.link && isValidStreamEmbedUrl(item.link))
              .map((item: any) => ({
                label: `Abyss (${item.language || 'HD'})`,
                url: sanitizeStreamUrl(item.link),
                isMultiAudio: false
              }));
          }
        }
      } catch (e) {
        if (isValidStreamEmbedUrl(streamUrl)) {
          sources = [{ label: 'HD-1 (Hindi)', url: sanitizeStreamUrl(streamUrl), isMultiAudio: true }];
        }
      }
    } else if (isValidStreamEmbedUrl(streamUrl)) {
      sources = [{ label: 'HD-1 (Hindi)', url: sanitizeStreamUrl(streamUrl), isMultiAudio: true }];
    }
  }

  if (sources.length === 0) {
    const saltSlug = (anime as any).saltSlug || anime.slug;
    const epNumber = episode.number || 1;
    const epSeason: number = (episode as any).season ?? (() => {
      const m = episode.slug.match(/(\d+)x\d+/i);
      return m ? parseInt(m[1], 10) : 1;
    })();

    // Directly resolve stream sources with in-memory caching and fast fallback
    try {
      const episodeTargetUrl = episode.url && episode.url.startsWith('http')
        ? episode.url
        : `https://animesalt.cx/series/${saltSlug}/`;

      const resolved = await resolveStreamSources(
        episodeTargetUrl,
        epNumber,
        epSeason
      );
      sources = resolved.filter(s => s.url && isValidStreamEmbedUrl(s.url));
    } catch (e) {
      console.error('Failed to resolve episode stream sources:', e);
      sources = [];
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
