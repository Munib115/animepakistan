export interface Episode {
  number: number;
  season?: number;
  title: string;
  slug: string;
  url: string;
  thumbnail: string;
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
  url: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  description: string;
  genres: string[];
  audioLanguages: string[];
  episodes?: Episode[];
  anilist?: AnilistMetadata | null;
}

