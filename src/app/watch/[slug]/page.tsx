import Header from '@/components/Header';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import WatchContainer from '@/components/WatchContainer';
import { resolveStreamSources } from '@/lib/resolver';
import { getAnimeDb } from '@/lib/db';
import { animeDescription, animeImage, animeName } from '@/lib/seo';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const anime = getAnimeDb().find((item) => item.type === 'movie' && item.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase());
  if (!anime) return { title: 'Movie Not Found', robots: { index: false, follow: false } };

  const name = animeName(anime);
  const description = animeDescription(anime);
  const url = `/watch/${anime.slug}`;
  return {
    title: `${name} Urdu & Hindi Dubbed Movie`,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'video.movie', url, title: `${name} Urdu & Hindi Dubbed Movie`, description, images: [{ url: animeImage(anime), alt: `${name} poster` }] },
    twitter: { card: 'summary_large_image', title: `${name} Urdu & Hindi Dubbed Movie`, description, images: [animeImage(anime)] },
  };
}

export default async function MovieWatchPage(props: PageProps) {
  const { slug } = await props.params;

  // Load database from in-memory cache
  const items = getAnimeDb();

  // Find movie
  const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();
  const anime = items.find((item) => {
    const itemSlug = item.slug.toLowerCase().trim();
    return (itemSlug === decodedSlug || itemSlug === decodedSlug.replace(/\/$/, '')) && item.type === 'movie';
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
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Movie Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              We could not find the requested movie watch page in our database.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Use pre-cached streamUrl from db first if available, otherwise resolve dynamically
  const cachedStreamUrl = (anime as any).streamUrl;
  const sources = cachedStreamUrl
    ? [{ label: 'Server 1', url: cachedStreamUrl as string, isMultiAudio: true }]
    : await resolveStreamSources(anime.url);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      <div className="hero-glow" />
      <Header />
      <main className="container" style={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
        <WatchContainer anime={anime} sources={sources} />
      </main>
      <Footer />
    </div>
  );
}
