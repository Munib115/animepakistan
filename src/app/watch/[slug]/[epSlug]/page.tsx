import Header from '@/components/Header';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import WatchContainer from '@/components/WatchContainer';
import { resolveStreamSources, StreamSource } from '@/lib/resolver';
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
    url: `https://animesalt.link/episode/${decodedEpSlug}/`,
    thumbnail: anime.poster || '',
  };

  // Use pre-saved direct server sources from database if available (instant on Vercel)
  let sources: StreamSource[] = [];
  if ((episode as any).sources && (episode as any).sources.length > 0) {
    sources = (episode as any).sources.map((s: any, idx: number) => ({
      label: s.lang ? `${s.name || 'Server'} (${s.lang})` : `Server ${idx + 1}`,
      url: s.url,
      isMultiAudio: true,
    }));
  } else if ((episode as any).streamUrl) {
    sources = [{ label: 'Server 1', url: (episode as any).streamUrl, isMultiAudio: true }];
  } else {
    sources = await resolveStreamSources(episode.url);
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
