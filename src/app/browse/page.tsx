import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BrowseContainer from '@/components/BrowseContainer';
import { getAnimeCatalog } from '@/lib/db';
import type { Metadata } from 'next';

interface BrowsePageProps {
  searchParams: Promise<{ type?: string }>;
}

export async function generateMetadata({ searchParams }: BrowsePageProps): Promise<Metadata> {
  const { type } = await searchParams;
  const isSeries = type === 'series';
  const isMovies = type === 'movies';
  const title = isSeries ? 'Urdu & Hindi Dubbed Anime Series' : isMovies ? 'Urdu & Hindi Dubbed Anime Movies' : 'Browse Urdu & Hindi Dubbed Anime';
  const description = isSeries
    ? 'Browse Urdu and Hindi dubbed anime series available for viewers in Pakistan.'
    : isMovies
      ? 'Browse Urdu and Hindi dubbed anime movies available for viewers in Pakistan.'
      : 'Browse anime series, movies and cartoons with Urdu and Hindi audio options in Pakistan.';

  return {
    title,
    description,
    alternates: { canonical: type ? `/browse?type=${type}` : '/browse' },
    robots: type && !isSeries && !isMovies ? { index: false, follow: true } : undefined,
  };
}

export default async function BrowsePage(props: BrowsePageProps) {
  const searchParams = await props.searchParams;
  const initialType = searchParams?.type || 'all';

  // Load lightweight anime catalog (95% smaller payload, ultra-fast)
  const items = getAnimeCatalog();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative' }}>
      <div className="hero-glow" />
      <Header />

      <main className="container" style={{ flexGrow: 1, padding: '24px 16px', position: 'relative', zIndex: 1 }}>
        <BrowseContainer initialItems={items} initialType={initialType} />
      </main>

      <Footer />
    </div>
  );
}
