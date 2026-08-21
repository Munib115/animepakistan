import type { MetadataRoute } from 'next';
import { getAnimeDb } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/browse'), lastModified, changeFrequency: 'daily', priority: 0.9 },
  ];

  const cataloguePages: MetadataRoute.Sitemap = getAnimeDb().map((anime) => ({
    url: absoluteUrl(anime.type === 'movie' ? `/watch/${anime.slug}` : `/anime/${anime.slug}`),
    lastModified,
    changeFrequency: anime.type === 'series' ? 'weekly' : 'monthly',
    priority: 0.8,
    images: anime.poster || anime.anilist?.coverImage ? [anime.poster || anime.anilist!.coverImage] : undefined,
  }));

  return [...staticPages, ...cataloguePages];
}
