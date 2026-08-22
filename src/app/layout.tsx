import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import AppLoader from '@/components/AppLoader';
import MobileTabBar from "@/components/MobileTabBar";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { LanguageProvider } from "@/context/LanguageContext";
import { absoluteUrl, siteName, siteUrl } from '@/lib/seo';

export const viewport: Viewport = {
  themeColor: "#006633",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Anime Pakistan | Urdu & Hindi Dubbed Anime',
    template: `%s | ${siteName}`,
  },
  description: 'Watch Urdu and Hindi dubbed anime series, movies and cartoons online in Pakistan. Browse a fast, mobile-friendly anime catalogue.',
  keywords: ['Urdu dubbed anime', 'Hindi dubbed anime', 'anime Pakistan', 'anime Urdu', 'anime movies Pakistan', 'cartoons in Urdu'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  openGraph: {
    type: 'website',
    locale: 'ur_PK',
    url: '/',
    siteName,
    title: 'Anime Pakistan | Urdu & Hindi Dubbed Anime',
    description: 'Watch Urdu and Hindi dubbed anime series, movies and cartoons online in Pakistan.',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Anime Pakistan logo' }],
  },
  twitter: { card: 'summary_large_image', title: 'Anime Pakistan | Urdu & Hindi Dubbed Anime', description: 'Browse Urdu and Hindi dubbed anime in Pakistan.', images: ['/icon-512.png'] },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/logo.png?v=ap5', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png?v=ap5', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png?v=ap5', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/logo.png?v=ap5',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Anime Pakistan",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ur" dir="rtl">
      <head>
        <link rel="icon" href="/logo.png?v=ap5" type="image/png" />
        <link rel="shortcut icon" href="/logo.png?v=ap5" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png?v=ap5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        
        {/* High-speed Google Fonts & Material Symbols CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Inter:wght@400;500;600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" 
          rel="stylesheet" 
        />

        {/* Preconnect to Poster Image CDNs for Instant 1-Second Loading */}
        {/* Modern Web Preconnects for high-speed streaming */}
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="preconnect" href="https://hsastream.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://hsastream.com" />
        <link rel="preconnect" href="https://s4.anilist.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://s4.anilist.co" />
      </head>
      <body>
        <AppLoader />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: absoluteUrl('/'), name: siteName, inLanguage: ['ur-PK', 'en-PK'] },
                { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: siteName, url: absoluteUrl('/'), logo: absoluteUrl('/icon-512.png'), areaServed: { '@type': 'Country', name: 'Pakistan' } },
              ],
            }).replace(/</g, '\\u003c'),
          }}
        />
        <LanguageProvider>
          {children}
          <MobileTabBar />
          <PWAInstallBanner />
          <PWARegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
