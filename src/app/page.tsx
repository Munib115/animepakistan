import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSlider from '@/components/HeroSlider';
import HomeSections from '@/components/HomeSections';
import AnimeGrid from '@/components/AnimeGrid';
import LiveChatFloating from '@/components/LiveChatFloating';
import { FAQS } from '@/data/faqs';
import { getAnimeCatalog } from '@/lib/db';
import { absoluteUrl, animeName } from '@/lib/seo';
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

  // Load lightweight catalog (without thousands of episode objects)
  const items = getAnimeCatalog();

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
        <LiveChatFloating />
      </div>
    );
  }

  // Top 8 featured items for Hero Banner (only send 8 items to client component)
  const featured = items
    .filter((item) => item.backdrop || item.anilist?.bannerImage)
    .sort((a, b) => (b.anilist?.rating || 0) - (a.anilist?.rating || 0))
    .slice(0, 8);

  // Categorize items for Landing Page
  const movies = items.filter((i) => i.type === 'movie');
  const series = items.filter((i) => i.type === 'series');

  // Top rated items
  const topRated = [...items].sort((a, b) => (b.anilist?.rating || 0) - (a.anilist?.rating || 0)).slice(0, 16);

  // Keep a broadly popular title at the front of the Trending row
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

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Featured Urdu and Hindi Dubbed Anime',
    numberOfItems: featured.length,
    itemListElement: featured.map((anime, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(anime.type === 'movie' ? `/watch/${anime.slug}` : `/anime/${anime.slug}`),
      name: animeName(anime),
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.qUr,
      acceptedAnswer: { '@type': 'Answer', text: faq.aUr },
    })),
    inLanguage: 'ur-PK',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      {/* Background Ambient Glow */}
      <div className="hero-glow" />

      {/* Global Header */}
      <Header />

      {/* Main Content */}
      <main style={{ flexGrow: 1, padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema).replace(/</g, '\\u003c') }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }} />
        {/* Accessible SEO H1 - Visually hidden to maintain clean cinematic streaming layout */}
        <h1 className="sr-only">
          Urdu & Hindi Dubbed Anime in Pakistan
        </h1>
        {/* Modern Anime Banner Carousel / Slider (Passing only 8 featured items!) */}
        <HeroSlider items={featured} />

        {/* Dynamic Multi-Language Categorized Rows */}
        <div className="container" style={{ padding: '0 16px' }}>
          <HomeSections 
            trendingSeries={trendingSeries}
            popularMovies={popularMovies}
            topRated={topRated}
            cartoons={cartoons}
          />
        </div>
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Floating Messenger Live Chat */}
      <LiveChatFloating />
    </div>
  );
}
