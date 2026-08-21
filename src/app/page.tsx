import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSlider from '@/components/HeroSlider';
import HomeSections from '@/components/HomeSections';
import AnimeGrid from '@/components/AnimeGrid';
import { getAnimeDb } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Urdu & Hindi Dubbed Anime in Pakistan',
  description: 'Watch Urdu and Hindi dubbed anime, anime movies and cartoons online in Pakistan. Discover popular series, new episodes and family favourites.',
  alternates: { canonical: '/' },
};

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function HomePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const initialType = searchParams?.type;

  const items = getAnimeDb();

  // If specific ?type=series or ?type=movies query is requested, render the filtered AnimeGrid directly!
  if (initialType && initialType !== 'all') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
        <div className="hero-glow" />
        <Header />
        <main className="container" style={{ flexGrow: 1, padding: '24px 16px', position: 'relative', zIndex: 1 }}>
          <AnimeGrid initialItems={items} initialType={initialType} />
        </main>
        <Footer />
      </div>
    );
  }

  // Categorize items for Landing Page
  const movies = items.filter((i) => i.type === 'movie');
  const series = items.filter((i) => i.type === 'series');

  // Top rated items
  const topRated = [...items].sort((a, b) => (b.anilist?.rating || 0) - (a.anilist?.rating || 0)).slice(0, 16);

  // Keep a broadly popular title at the front of the Trending row instead of the catalogue's first item.
  const trendingSeries = [...series]
    .sort((a, b) => {
      if (a.slug === 'one-piece') return -1;
      if (b.slug === 'one-piece') return 1;
      if (a.slug === 'rascal-does-not-dream-of-bunny-girl-senpai') return 1;
      if (b.slug === 'rascal-does-not-dream-of-bunny-girl-senpai') return -1;
      return 0;
    })
    .slice(0, 16);

  // Popular movies
  const popularMovies = movies.slice(0, 16);

  // Cartoons & Classics
  const cartoons = items.filter((i) => {
    const t = i.title.toLowerCase();
    return t.includes('ben 10') || t.includes('shinchan') || t.includes('doraemon') || 
           t.includes('pokemon') || t.includes('avatar') || t.includes('transformers') ||
           t.includes('miraculous') || t.includes('slugterra') || t.includes('avengers');
  }).slice(0, 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      {/* Background Ambient Glow */}
      <div className="hero-glow" />

      {/* Global Header */}
      <Header />

      {/* Main Content */}
      <main className="container" style={{ flexGrow: 1, padding: '16px 16px 20px', position: 'relative', zIndex: 1 }}>
        {/* Modern Anime Banner Carousel / Slider */}
        <HeroSlider items={items} />

        {/* Dynamic Multi-Language Categorized Rows */}
        <HomeSections 
          trendingSeries={trendingSeries}
          popularMovies={popularMovies}
          topRated={topRated}
          cartoons={cartoons}
        />
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
