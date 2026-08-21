'use client';

import React from 'react';
import { AnimeItem } from '@/types/anime';
import AnimeRow from './AnimeRow';
import FAQSection from './FAQSection';
import ContinueWatchingSection from './ContinueWatchingSection';
import { useLanguage } from '@/context/LanguageContext';

interface HomeSectionsProps {
  trendingSeries: AnimeItem[];
  popularMovies: AnimeItem[];
  topRated: AnimeItem[];
  cartoons: AnimeItem[];
}

export default function HomeSections({
  trendingSeries,
  popularMovies,
  topRated,
  cartoons,
}: HomeSectionsProps) {
  const { t } = useLanguage();

  return (
    <div>
      {/* Continue Watching History Row */}
      <ContinueWatchingSection />

      {/* Trending Series Row */}
      <AnimeRow 
        title={t('trendingSeries')} 
        items={trendingSeries} 
        browseHref="/browse?type=series" 
      />

      {/* Popular Anime Movies Row */}
      <AnimeRow 
        title={t('popularMovies')} 
        items={popularMovies} 
        browseHref="/browse?type=movies" 
      />

      {/* Top Rated Anime Row */}
      <AnimeRow 
        title={t('topRated')} 
        items={topRated} 
        browseHref="/browse" 
      />

      {/* Cartoons & Classics Row */}
      {cartoons.length > 0 && (
        <AnimeRow 
          title={t('cartoonsSection')} 
          items={cartoons} 
          browseHref="/browse" 
        />
      )}

      {/* SEO-Rich FAQ Section */}
      <FAQSection />
    </div>
  );
}
