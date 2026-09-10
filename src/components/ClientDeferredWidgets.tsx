'use client';

import dynamic from 'next/dynamic';

const PWAInstallBanner = dynamic(() => import('@/components/PWAInstallBanner'), {
  ssr: false,
});

const LiveChatFloating = dynamic(() => import('@/components/LiveChatFloating'), {
  ssr: false,
});

const OfflineDetector = dynamic(() => import('@/components/OfflineDetector'), {
  ssr: false,
});

export default function ClientDeferredWidgets() {
  return (
    <>
      <PWAInstallBanner />
      <LiveChatFloating />
      <OfflineDetector />
    </>
  );
}
