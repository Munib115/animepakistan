export interface StreamMirrorSource {
  label: string;
  url: string;
  isMultiAudio?: boolean;
}

export interface Episode {
  number: number;
  season?: number;
  title: string;
  slug: string;
  url: string;
  thumbnail: string;
  /** Active working stream embed URL */
  streamUrl?: string;
  /** Preserved AnimeSalt stream embed URL (backup) */
  saltStreamUrl?: string;
  /** Preserved AnimeSalt episode page URL */
  saltUrl?: string;
  /** ToonStream stream embed URL */
  toonStreamUrl?: string;
  /** ToonStream episode page URL */
  toonUrl?: string;
  /** Pre-parsed working stream sources/mirrors */
  streamSources?: StreamMirrorSource[];
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
  /** The animesalt.me /tv/{saltSlug}/ page slug */
  saltSlug?: string;
  /** The toonstream.us /series/{toonSlug}/ page slug */
  toonSlug?: string;
  url: string;
  /** Preserved AnimeSalt URL */
  saltUrl?: string;
  /** ToonStream series or movie URL */
  toonUrl?: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  description: string;
  genres: string[];
  audioLanguages: string[];
  episodes?: Episode[];
  episodeCount?: number;
  episodesCount?: number;
  anilist?: AnilistMetadata | null;
  /** Active working stream embed URL (for movies) */
  streamUrl?: string;
  /** Preserved AnimeSalt stream embed URL (backup) */
  saltStreamUrl?: string;
  /** ToonStream stream embed URL */
  toonStreamUrl?: string;
  /** Pre-parsed working stream sources/mirrors */
  streamSources?: StreamMirrorSource[];
  source?: string;
}

