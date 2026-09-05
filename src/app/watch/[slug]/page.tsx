import Header from '@/components/Header';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import WatchContainer from '@/components/WatchContainer';
import { StreamSource, sanitizeStreamUrl, isValidStreamEmbedUrl } from '@/lib/resolver';
import { resolveStreamSources } from '@/lib/resolver-server';
import { getAnimeDb } from '@/lib/db';
import { animeDescription, animeImage, animeName } from '@/lib/seo';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const maxDuration = 30;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const anime = getAnimeDb().find((item) => item.type === 'movie' && item.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase());
  if (!anime) return { title: 'Movie Not Found', robots: { index: false, follow: false } };

  const name = animeName(anime);
  const description = animeDescription(anime);
  const url = `/watch/${anime.slug}`;
  return {
    title: `Watch ${name} Urdu & Hindi Dubbed Movie`,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'video.other', url, title: `Watch ${name} Urdu & Hindi Dubbed Movie`, description, images: [{ url: animeImage(anime), alt: `${name} poster` }] },
    twitter: { card: 'summary_large_image', title: `Watch ${name} Urdu & Hindi Dubbed Movie`, description, images: [animeImage(anime)] },
  };
}

export default async function MovieWatchPage(props: PageProps) {
  const { slug } = await props.params;

  // Load database from in-memory cache
  const items = getAnimeDb();

  // Find target movie with flexible slug matching
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
              We could not find the requested anime movie in our database.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Resolve streams with priority:
  // 1. Pre-cached streamUrl on the anime object
  // 2. New animesalt-stream API (saltSlug, no episode number → first/only stream)
  // 3. General resolver (legacy fallback)
  let sources: StreamSource[] = [];

  if (anime.streamUrl) {
    if (anime.streamUrl.includes('multi-lang-plyr/player.php?data=')) {
      try {
        const urlObj = new URL(anime.streamUrl);
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
        sources = [{ label: 'HD-1 (Hindi)', url: anime.streamUrl, isMultiAudio: true }];
      }
    } else {
      sources = [{ label: 'HD-1 (Hindi)', url: anime.streamUrl, isMultiAudio: true }];
    }
  }

  if (sources.length === 0) {
    const saltSlug = anime.saltSlug || anime.slug;

    // Directly resolve stream sources with in-memory caching
    try {
      const resolved = await resolveStreamSources(
        anime.url && anime.url.startsWith('http') ? anime.url : `https://animesalt.cx/movies/${saltSlug}/`
      );
      sources = resolved.filter(s => s.url && isValidStreamEmbedUrl(s.url));
    } catch (e) {
      sources = [];
    }

    if (sources.length === 0 && anime.url && isValidStreamEmbedUrl(anime.url)) {
      sources = [{
        label: 'Server 1 (HD)',
        url: sanitizeStreamUrl(anime.url),
        isMultiAudio: true,
      }];
    }
  }

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
