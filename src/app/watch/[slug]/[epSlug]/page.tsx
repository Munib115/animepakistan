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

  // Resolve streams cleanly using unified resolver-server
  let sources: StreamSource[] = [];
  const saltSlug = (anime as any).saltSlug || anime.slug;
  const toonSlug = (anime as any).toonSlug;
  const epNumber = episode.number || 1;
  const epSeason: number = (episode as any).season ?? (() => {
    const m = episode.slug.match(/(\d+)x\d+/i);
    return m ? parseInt(m[1], 10) : 1;
  })();

  // 1. Instant check for pre-cached streamSources on episode
  if ((episode as any).streamSources && (episode as any).streamSources.length > 0) {
    // Ensure AnimeSalt is placed first as Server 1 / HD
    sources = [...(episode as any).streamSources].map((s: any) => {
      if (s.label?.includes('(Backup)')) {
        return { ...s, label: s.label.replace(' (Backup)', ' (HD)') };
      }
      return s;
    }).sort((a: any, b: any) => {
      const aIsSalt = (a.label?.includes('AnimeSalt') || a.url?.includes('as-cdn') || a.url?.includes('animesalt')) ? -1 : 1;
      const bIsSalt = (b.label?.includes('AnimeSalt') || b.url?.includes('as-cdn') || b.url?.includes('animesalt')) ? -1 : 1;
      return aIsSalt - bIsSalt;
    });
  } else if ((episode as any).saltStreamUrl || episode.streamUrl || (episode as any).toonStreamUrl) {
    if ((episode as any).saltStreamUrl || episode.streamUrl) {
      const saltStream = (episode as any).saltStreamUrl || episode.streamUrl;
      sources.push({ label: 'AnimeSalt (HD)', url: sanitizeStreamUrl(saltStream), isMultiAudio: true });
    }
    if ((episode as any).toonStreamUrl && (episode as any).toonStreamUrl !== episode.streamUrl) {
      sources.push({ label: 'ToonStream (Mirror)', url: sanitizeStreamUrl((episode as any).toonStreamUrl), isMultiAudio: true });
    }
  }

  // 2. Fallback to dynamic resolution if not pre-cached (Prioritize AnimeSalt)
  if (sources.length === 0) {
    const episodeTargetUrl = (episode.url && episode.url.includes('animesalt') ? episode.url : null)
      || (saltSlug ? `https://animesalt.cx/episode/${saltSlug}-${epSeason}x${epNumber}/` : null)
      || (episode as any).toonUrl
      || (toonSlug ? `https://toonstream.us/episode/${toonSlug}-${epSeason}x${epNumber}/` : null)
      || (episode.url && episode.url.startsWith('http') ? episode.url : `https://animesalt.cx/episode/${saltSlug}-${epSeason}x${epNumber}/`);

    try {
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
