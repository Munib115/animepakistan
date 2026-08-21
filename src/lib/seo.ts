import type { AnimeItem } from '@/types/anime';

// Set NEXT_PUBLIC_SITE_URL to the exact HTTPS production domain before launch.
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://animepakistan.pk';

export const siteUrl = configuredSiteUrl.replace(/\/$/, '');
export const siteName = 'Anime Pakistan';

export function absoluteUrl(path = '/') {
  return new URL(path, `${siteUrl}/`).toString();
}

export function plainText(value?: string, limit = 155) {
  const text = (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

export function animeName(anime: AnimeItem) {
  return anime.anilist?.englishName || anime.anilist?.romajiName || anime.title;
}

export function animeDescription(anime: AnimeItem) {
  const languages = anime.audioLanguages?.length ? ` Available in ${anime.audioLanguages.join(', ')}.` : '';
  const fallback = `Watch ${animeName(anime)} online on Anime Pakistan.${languages}`;
  return plainText(anime.anilist?.description || anime.description || fallback);
}

export function animeImage(anime: AnimeItem) {
  return anime.anilist?.coverImage || anime.poster || anime.backdrop || absoluteUrl('/icon-512.png');
}
