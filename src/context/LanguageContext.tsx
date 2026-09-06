'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ur' | 'en';

interface Translations {
  [key: string]: {
    ur: string;
    en: string;
  };
}

export const translations: Translations = {
  // Brand & Navigation
  brandSubtitle: {
    ur: 'اردو اور ہندی میں مفت اینیمے اسٹریمنگ',
    en: 'Free Urdu & Hindi Anime Streaming',
  },
  home: {
    ur: 'ہوم',
    en: 'Home',
  },
  browse: {
    ur: 'کیٹلاگ',
    en: 'Browse',
  },
  series: {
    ur: 'سیریز',
    en: 'Series',
  },
  movies: {
    ur: 'موویز',
    en: 'Movies',
  },
  search: {
    ur: 'تلاش',
    en: 'Search',
  },
  searchAction: {
    ur: 'تلاش کریں',
    en: 'Search',
  },

  // Homepage Rows & Sections
  watchNow: {
    ur: 'ابھی دیکھیں',
    en: 'Watch Now',
  },
  details: {
    ur: 'تفصیلات',
    en: 'Details',
  },
  trendingSeries: {
    ur: 'تازہ ترین اینیمے سیریز (Trending Series)',
    en: 'Trending Anime Series',
  },
  popularMovies: {
    ur: 'مشہور اینیمے موویز (Popular Movies)',
    en: 'Popular Anime Movies',
  },
  topRated: {
    ur: 'ٹاپ ریٹڈ اینیمے (Top Rated)',
    en: 'Top Rated Anime',
  },
  cartoonsSection: {
    ur: 'کارٹونز اور ڈب اینیمے (Cartoons & Classics)',
    en: 'Cartoons & Classics',
  },
  viewAll: {
    ur: 'سب دیکھیں',
    en: 'View All',
  },
  browseCtaTitle: {
    ur: 'تمام 510+ اینیمے اور موویز براؤز کریں',
    en: 'Browse All 510+ Anime & Movies',
  },
  browseCtaDesc: {
    ur: 'مکمل کیٹلاگ کو زبان، الفابیٹ (A-Z)، مووی یا سیریز کے فلٹرز کے ساتھ دیکھیں۔',
    en: 'Explore the complete catalog filtered by language, A-Z letters, movies, or series.',
  },
  browseCtaBtn: {
    ur: 'مکمل کیٹلاگ کھولیں (Browse All)',
    en: 'Open Full Catalog',
  },

  // Browse Page (/browse)
  browsePageTitle: {
    ur: 'مکمل اینیمے کیٹلاگ اور فلٹرز',
    en: 'Full Anime Catalog & Filters',
  },
  browsePageDesc: {
    ur: 'تمام اینیمے، کارٹونز اور موویز تلاش کریں اور اپنی پسندیدہ زبان میں اسٹریم کریں۔',
    en: 'Search and stream all anime, cartoons, and movies in your preferred language.',
  },
  backToHome: {
    ur: 'ہوم پیج پر واپس جائیں',
    en: 'Back to Home',
  },

  // Filter Bar
  searchPlaceholder: {
    ur: 'انیمے یا مووی تلاش کریں (Search anime...)',
    en: 'Search anime movies or series...',
  },
  filterAll: {
    ur: 'تمام (All)',
    en: 'All',
  },
  filterSeries: {
    ur: 'سیریز (Series)',
    en: 'Series',
  },
  filterMovies: {
    ur: 'موویز (Movies)',
    en: 'Movies',
  },
  audioLabel: {
    ur: 'زبان (Audio):',
    en: 'Audio Language:',
  },
  filterAtoZ: {
    ur: 'الفابیٹ',
    en: 'A to Z',
  },
  filterLanguage: {
    ur: 'زبان',
    en: 'Audio Language',
  },
  allAnimeCatalog: {
    ur: 'تمام اینیمے کیٹلاگ',
    en: 'All Anime Catalog',
  },
  catalogResultsCount: {
    ur: 'اینیمے',
    en: 'Anime',
  },
  catalogHeadingAll: {
    ur: 'تمام کیٹلاگ (All Anime)',
    en: 'All Anime Catalog',
  },
  catalogHeadingSeries: {
    ur: 'تمام سیریز (Series)',
    en: 'Anime Series Catalog',
  },
  catalogHeadingMovies: {
    ur: 'تمام موویز (Movies)',
    en: 'Anime Movies Catalog',
  },
  animeCountSuffix: {
    ur: 'اینیمے',
    en: 'Anime',
  },
  noResultsTitle: {
    ur: 'کوئی اینیمے نہیں ملا',
    en: 'No Anime Found',
  },
  noResultsDesc: {
    ur: 'براہ کرم کوئی دوسرا نام تلاش کریں یا فلٹرز کو ری سیٹ کریں۔',
    en: 'Please search for another title or reset your filters.',
  },
  resetFilters: {
    ur: 'تمام فلٹرز صاف کریں (Reset Filters)',
    en: 'Reset Filters',
  },

  // Anime Card
  episodesSuffix: {
    ur: 'ایپی سوڈز',
    en: 'Episodes',
  },
  movieBadge: {
    ur: 'مووی',
    en: 'MOVIE',
  },
  seriesBadge: {
    ur: 'سیریز',
    en: 'SERIES',
  },

  // Detail Page
  backToCatalog: {
    ur: 'واپس کیٹلاگ پر جائیں',
    en: 'Back to Catalog',
  },
  playMovie: {
    ur: 'مووی دیکھیں (Play Movie)',
    en: 'Play Movie',
  },
  availableAudio: {
    ur: 'دستیاب آڈیو زبانیں (Available Audio):',
    en: 'Available Audio Languages:',
  },
  overview: {
    ur: 'تفصیل (Overview)',
    en: 'Overview',
  },
  episodesList: {
    ur: 'ایپی سوڈز کی فہرست (Episodes List)',
    en: 'Episodes List',
  },
  episodePrefix: {
    ur: 'ایپی سوڈ',
    en: 'Episode',
  },
  loadingEpisodes: {
    ur: 'اس سیریز کے ایپی سوڈز لوڈ ہو رہے ہیں۔',
    en: 'Loading episodes for this series...',
  },
  detailsComingSoon: {
    ur: 'اس اینیمے کی تفصیلات جلد شامل کر دی جائیں گی۔',
    en: 'Details for this anime will be added soon.',
  },

  // Watch Container
  serverLabel: {
    ur: 'اسٹریمنگ سرور (Server):',
    en: 'Streaming Server:',
  },
  mainServer: {
    ur: 'مین سرور (Fast HD)',
    en: 'Primary Server (Fast HD)',
  },
  serverPrefix: {
    ur: 'سرور',
    en: 'Server',
  },
  prevEpisode: {
    ur: 'پچھلا ایپی سوڈ',
    en: 'Previous Episode',
  },
  nextEpisode: {
    ur: 'اگلا ایپی سوڈ',
    en: 'Next Episode',
  },
  firstEpisode: {
    ur: 'پہلا ایپی سوڈ',
    en: 'First Episode',
  },
  lastEpisode: {
    ur: 'آخری ایپی سوڈ',
    en: 'Last Episode',
  },
  connectingServer: {
    ur: 'اسٹریمنگ سرور منسلک ہو رہا ہے...',
    en: 'Connecting to streaming server...',
  },

  // Footer
  footerDesc: {
    ur: 'اردو اور ہندی میں مفت اینیمے اور کارٹون اسٹریمنگ پلیٹ فارم۔',
    en: 'Free anime and cartoon streaming platform in Urdu & Hindi.',
  },
  footerRights: {
    ur: 'جملہ حقوق محفوظ ہیں۔',
    en: 'All rights reserved.',
  },
  footerPwa: {
    ur: 'فاسٹ PWA پروگریسو ویب ایپ برائے موبائل و ڈیسک ٹاپ',
    en: 'Fast PWA Progressive Web App for Mobile & Desktop',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ur',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations[key]?.ur || '',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ur');

  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    if (saved === 'en' || saved === 'ur') {
      setLanguageState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === 'ur' ? 'rtl' : 'ltr';
    } else {
      setLanguageState('ur');
      document.documentElement.lang = 'ur';
      document.documentElement.dir = 'rtl';
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  };

  const toggleLanguage = () => {
    const next = language === 'ur' ? 'en' : 'ur';
    setLanguage(next);
  };

  const t = (key: keyof typeof translations): string => {
    if (!translations[key]) return String(key);
    return translations[key][language] || translations[key].ur;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
