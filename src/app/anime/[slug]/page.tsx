import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AnimeDetailView from '@/components/AnimeDetailView';
import { getAnimeDb } from '@/lib/db';
import { absoluteUrl, animeDescription, animeImage, animeName } from '@/lib/seo';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const anime = getAnimeDb().find((item) => item.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase());
  if (!anime) return { title: 'Anime Not Found', robots: { index: false, follow: false } };

  const name = animeName(anime);
  const description = animeDescription(anime);
  const url = anime.type === 'movie' ? `/watch/${anime.slug}` : `/anime/${anime.slug}`;
  return {
    title: `${name} Urdu & Hindi Dubbed ${anime.type === 'movie' ? 'Movie' : 'Episodes'}`,
    description,
    alternates: { canonical: url },
    openGraph: { type: anime.type === 'movie' ? 'video.movie' : 'video.tv_show', url, title: `${name} Urdu & Hindi Dubbed`, description, images: [{ url: animeImage(anime), alt: `${name} poster` }] },
    twitter: { card: 'summary_large_image', title: `${name} Urdu & Hindi Dubbed`, description, images: [animeImage(anime)] },
  };
}

export default async function AnimeDetailPage(props: PageProps) {
  const { slug } = await props.params;

  // Load database from in-memory cache
  const items = getAnimeDb();

  // Find target anime with flexible slug matching
  const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();
  const anime = items.find((item) => {
    const itemSlug = item.slug.toLowerCase().trim();
    return itemSlug === decodedSlug || itemSlug === decodedSlug.replace(/\/$/, '') || item.url.includes(`/${decodedSlug}/`);
  });

  if (!anime) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <Header />
        <main className="container" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
          <div className="glass-panel" style={{ padding: '40px 24px', textAlign: 'center', maxWidth: '480px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '16px' }}>
              error_outline
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>اینیمے نہیں ملا (Not Found)</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
              مطلوبہ اینیمے کا صفحہ دستیاب نہیں ہے۔
            </p>
            <Link href="/" className="glass-btn" style={{ marginTop: '20px' }}>
              ہوم پیج پر واپس جائیں
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (anime.type === 'movie') {
    redirect(`/watch/${anime.slug}`);
  }

  // Discover related franchise titles (e.g. Dragon Ball -> DBZ, Super, Daima; Naruto -> Shippuden, Boruto; Ben 10 -> Alien Force, etc.)
  const stopWords = new Set(['the', 'a', 'an', 'in', 'of', 'to', 'for', 'and', 'with']);
  const slugParts = anime.slug.toLowerCase().split('-');
  const meaningfulParts = slugParts.filter((p) => !stopWords.has(p) && p.length > 2);
  const rootSlug = meaningfulParts[0] || slugParts[0];
  const secondarySlug = meaningfulParts[1] || '';
  const compoundPrefixes = ['dragon', 'ben', 'fairy', 'sword', 'attack', 'demon', 'jujutsu', 'tokyo', 'my', 'hunter', 'yu', 'ninja', 'sailor', 'one', 'digimon', 'beyblade', 'doraemon', 'shinchan', 'tomb', 'devil', 'naruto', 'bleach'];
  const franchiseKey = compoundPrefixes.includes(rootSlug) && secondarySlug && !['1979', '2005', 'classic', 'reboot', 'super', 'z', 'shippuden'].includes(secondarySlug)
    ? (rootSlug === 'dragon' ? 'dragon-ball' : rootSlug === 'ben' ? 'ben-10' : rootSlug === 'one' ? 'one-piece' : `${rootSlug}-${secondarySlug}`)
    : rootSlug;

  const relatedAnime = franchiseKey && franchiseKey.length >= 3
    ? items
        .filter((item) => {
          if (item.slug === anime.slug) return false;
          const itemSlug = item.slug.toLowerCase();
          const itemTitle = item.title.toLowerCase();
          return (
            itemSlug.startsWith(`${franchiseKey}-`) ||
            itemSlug.endsWith(`-${franchiseKey}`) ||
            itemSlug.includes(`-${franchiseKey}-`) ||
            itemSlug === franchiseKey ||
            itemTitle.includes(franchiseKey.replace('-', ' '))
          );
        })
        .slice(0, 12)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      <div className="hero-glow" />
      <Header />
      <main className="container" style={{ flexGrow: 1, padding: '24px 16px', position: 'relative', zIndex: 1 }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'TVSeries',
              name: animeName(anime),
              description: animeDescription(anime),
              url: absoluteUrl(`/anime/${anime.slug}`),
              image: animeImage(anime),
              genre: anime.anilist?.genres || anime.genres,
              numberOfEpisodes: anime.episodes?.length,
            }).replace(/</g, '\\u003c'),
          }}
        />
        <AnimeDetailView anime={anime} relatedAnime={relatedAnime} />
      </main>
      <Footer />
    </div>
  );
}
