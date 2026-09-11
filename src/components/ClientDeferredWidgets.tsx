'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const PWAInstallBanner = dynamic(() => import('@/components/PWAInstallBanner'), {
  ssr: false,
});

const LiveChatFloating = dynamic(() => import('@/components/LiveChatFloating'), {
  ssr: false,
});

const OfflineDetector = dynamic(() => import('@/components/OfflineDetector'), {
  ssr: false,
});

const GameCachePreloader = dynamic(() => import('@/components/GameCachePreloader'), {
  ssr: false,
});

export default function ClientDeferredWidgets() {
  const pathname = usePathname();
  if (pathname === '/offline' || pathname?.startsWith('/offline')) {
    return null;
  }

  return (
    <>
      <PWAInstallBanner />
      <LiveChatFloating />
      <OfflineDetector />
      <GameCachePreloader />
    </>
  );
}
