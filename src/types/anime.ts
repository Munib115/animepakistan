export interface Episode {
  number: number;
  season?: number;
  title: string;
  slug: string;
  url: string;
  thumbnail: string;
  /** Pre-cached stream embed URL from animesalt.me */
  streamUrl?: string;
}

export interface AnilistMetadata {
  id: number;
  romajiName: string;
  englishName: string;
  nativeName: string;
  description: string;
  coverImage: string;
  bannerImage: string;
  rating: number | null;
  year: number | null;
  season: string;
  status: string;
  genres: string[];
}

export interface AnimeItem {
  title: string;
  slug: string;
  /** The animesalt.me /tv/{saltSlug}/ page slug (may differ from local slug) */
  saltSlug?: string;
  url: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  description: string;
  genres: string[];
  audioLanguages: string[];
  episodes?: Episode[];
  episodeCount?: number;
  anilist?: AnilistMetadata | null;
  /** Pre-cached stream embed URL (for movies) */
  streamUrl?: string;
}

