'use client';

import { useEffect } from 'react';
import { adblockShield } from '@/lib/adblockShield';

/**
 * Global Ghostery / uBlock AdBlock Shield Client Component
 * Mounts at root layout level to protect all routes from popups, rogue redirects, and clickjacks
 */
export default function AdBlockGlobalShield() {
  useEffect(() => {
    // Initialize Ghostery adblock engine immediately on client mount
    adblockShield.init();
  }, []);

  return null;
}
