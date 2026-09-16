'use client';

import { useEffect } from 'react';
import { adblockShield } from '@/lib/adblockShield';
import { watchTimeTracker } from '@/lib/watchTimeTracker';

/**
 * Global Ghostery / uBlock AdBlock Shield & Watch Time Tracker Client Component
 * Mounts at root layout level to protect all routes and track real-time watch engagement
 */
export default function AdBlockGlobalShield() {
  useEffect(() => {
    // Initialize Ghostery adblock engine immediately on client mount
    adblockShield.init();
    // Initialize real-time watch time tracker
    watchTimeTracker.init();
  }, []);

  return null;
}
