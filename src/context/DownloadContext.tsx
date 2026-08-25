'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface DownloadItem {
  id: string; // unique ID (e.g. animeSlug-epSlug)
  title: string;
  subtitle: string;
  progress: number; // 0 to 100
  status: 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  speed: string; // e.g. "1.5 MB/s"
  downloadedMB: number;
  totalMB: number;
  totalChunks: number;
  downloadedChunks: number;
}

interface DownloadContextType {
  downloads: DownloadItem[];
  startDownload: (animeSlug: string, epSlug: string, animeTitle: string, epTitle: string, streamUrl: string) => Promise<void>;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  clearCompleted: () => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

const DB_NAME = 'AnimeDownloadsDB';
const DB_VERSION = 1;

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to write to IndexedDB store
async function writeDB(storeName: 'metadata' | 'chunks', key: string | null, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = storeName === 'metadata' ? store.put(value) : store.put(value, key!);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to read from IndexedDB store
async function readDB(storeName: 'metadata' | 'chunks', key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to delete from IndexedDB store
async function deleteDB(storeName: 'metadata' | 'chunks', key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to get all items from metadata store
async function getAllMetadata(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readonly');
    const store = tx.objectStore('metadata');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const activeJobsRef = useRef<{ [id: string]: { cancelled: boolean; paused: boolean } }>({});
  
  // Speed calculation tracks
  const speedTrackerRef = useRef<{ [id: string]: { bytesDownloaded: number; lastTime: number } }>({});

  // 1. Load active downloads from IndexedDB on startup
  useEffect(() => {
    async function loadDownloads() {
      try {
        const metadataList = await getAllMetadata();
        const loaded = metadataList.map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: m.subtitle,
          progress: Math.round((m.downloadedChunks / m.totalChunks) * 100) || 0,
          status: m.status === 'downloading' ? 'paused' : m.status, // resume paused on start
          speed: '0 KB/s',
          downloadedMB: parseFloat(((m.downloadedChunks * 0.45)).toFixed(1)), // estimation
          totalMB: parseFloat(((m.totalChunks * 0.45)).toFixed(1)),
          totalChunks: m.totalChunks,
          downloadedChunks: m.downloadedChunks,
        }));
        setDownloads(loaded);
      } catch (err) {
        console.error('Failed to load downloads metadata:', err);
      }
    }
    loadDownloads();
  }, []);

  // Update speed calculations periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.status !== 'downloading') return { ...d, speed: '0 KB/s' };
          const tracker = speedTrackerRef.current[d.id];
          if (!tracker) return d;

          const now = Date.now();
          const durationSec = (now - tracker.lastTime) / 1000;
          if (durationSec <= 0) return d;

          const speedBytesPerSec = tracker.bytesDownloaded / durationSec;
          let speedStr = '0 KB/s';
          if (speedBytesPerSec > 1024 * 1024) {
            speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          } else if (speedBytesPerSec > 1024) {
            speedStr = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`;
          }

          // reset tracker
          speedTrackerRef.current[d.id] = { bytesDownloaded: 0, lastTime: now };
          return { ...d, speed: speedStr };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 2. Main start download workflow
  const startDownload = async (
    animeSlug: string,
    epSlug: string,
    animeTitle: string,
    epTitle: string,
    streamUrl: string
  ) => {
    const id = `${animeSlug}-${epSlug}`;

    // Prevent duplicates
    if (downloads.some((d) => d.id === id && (d.status === 'downloading' || d.status === 'paused'))) {
      return;
    }

    // Add initial item
    const newItem: DownloadItem = {
      id,
      title: animeTitle,
      subtitle: epTitle,
      progress: 0,
      status: 'downloading',
      speed: 'Estimating...',
      downloadedMB: 0,
      totalMB: 0,
      totalChunks: 0,
      downloadedChunks: 0,
    };

    setDownloads((prev) => [newItem, ...prev.filter((d) => d.id !== id)]);
    activeJobsRef.current[id] = { cancelled: false, paused: false };
    speedTrackerRef.current[id] = { bytesDownloaded: 0, lastTime: Date.now() };

    try {
      // Step 1: Resolve the actual .m3u8 source URL from the stream URL if it's an iframe
      let m3u8Url = '';
      if (streamUrl.includes('as-cdn') && streamUrl.includes('/video/')) {
        const hash = streamUrl.split('/video/')[1]?.split('?')[0];
        const res = await fetch(`/api/download-video/ajax-source?hash=${hash}`);
        const data = await res.json();
        m3u8Url = data.securedLink || data.videoSource;
      } else if (streamUrl.includes('short.icu') || streamUrl.includes('player.php')) {
        // Resolve target directly
        m3u8Url = streamUrl;
      } else {
        // Assume direct streamUrl is already m3u8 or video file
        m3u8Url = streamUrl;
      }

      if (!m3u8Url) {
        throw new Error('Failed to resolve playlist stream source');
      }

      // Step 2: Fetch the list of segment URLs from backend
      const segRes = await fetch(`/api/download-video/segments?url=${encodeURIComponent(m3u8Url)}`);
      if (!segRes.ok) {
        throw new Error('Failed to parse HLS segment chunks');
      }

      const { segments } = await segRes.json();
      if (!segments || segments.length === 0) {
        throw new Error('No downloadable segments found');
      }

      const totalChunks = segments.length;
      const totalMB = parseFloat(((totalChunks * 0.45)).toFixed(1)); // Estimate size

      // Save initial metadata in IndexedDB
      const meta = {
        id,
        title: animeTitle,
        subtitle: epTitle,
        status: 'downloading',
        totalChunks,
        downloadedChunks: 0,
        segments,
      };
      await writeDB('metadata', id, meta);

      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, totalChunks, totalMB } : d))
      );

      // Start fetching chunks
      downloadChunks(id, meta);
    } catch (err: any) {
      console.error('Download start failed:', err);
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'failed', speed: 'Error' } : d))
      );
      await writeDB('metadata', id, {
        id,
        title: animeTitle,
        subtitle: epTitle,
        status: 'failed',
        totalChunks: 0,
        downloadedChunks: 0,
        segments: [],
      });
    }
  };

  // Helper function to fetch HLS chunks in parallel with a concurrency worker queue
  const downloadChunks = async (id: string, meta: any) => {
    const { segments, totalChunks } = meta;
    let downloadedChunks = meta.downloadedChunks;

    const job = activeJobsRef.current[id];
    if (!job) return;

    // Determine which chunks are already downloaded (to allow pausing and resuming!)
    const chunkPromises = [];
    const missingIndices: number[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const cacheKey = `${id}_${i}`;
      chunkPromises.push(readDB('chunks', cacheKey));
    }

    const cachedResults = await Promise.all(chunkPromises);
    cachedResults.forEach((val, index) => {
      if (!val) {
        missingIndices.push(index);
      }
    });

    downloadedChunks = totalChunks - missingIndices.length;

    // Update downloaded chunks counter
    setDownloads((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              downloadedChunks,
              progress: Math.round((downloadedChunks / totalChunks) * 100),
              downloadedMB: parseFloat(((downloadedChunks * 0.45)).toFixed(1)),
            }
          : d
      )
    );

    if (missingIndices.length === 0) {
      // Already fully finished, compile directly
      compileAndSaveFile(id, meta);
      return;
    }

    // Workers setup (concurrency limit = 3 parallel downloads)
    let nextIndex = 0;
    const workerCount = Math.min(3, missingIndices.length);
    let activeWorkers = workerCount;

    const runWorker = async () => {
      while (nextIndex < missingIndices.length && !job.cancelled && !job.paused) {
        const segIdx = missingIndices[nextIndex++];
        const url = segments[segIdx];

        let retries = 3;
        let success = false;
        let buffer: ArrayBuffer | null = null;

        while (retries > 0 && !success && !job.cancelled && !job.paused) {
          try {
            const startFetchTime = Date.now();
            const res = await fetch(`/api/download-video/chunk?url=${encodeURIComponent(url)}`);
            if (res.ok) {
              buffer = await res.arrayBuffer();
              success = true;

              // Track bytes for speed indicator
              if (speedTrackerRef.current[id]) {
                speedTrackerRef.current[id].bytesDownloaded += buffer.byteLength;
              }
            } else {
              retries--;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (e) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (success && buffer) {
          // Write chunk to database
          const cacheKey = `${id}_${segIdx}`;
          await writeDB('chunks', cacheKey, buffer);
          downloadedChunks++;

          // Update state and metadata
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    downloadedChunks,
                    progress: Math.round((downloadedChunks / totalChunks) * 100),
                    downloadedMB: parseFloat(((downloadedChunks * 0.45)).toFixed(1)),
                  }
                : d
            )
          );

          // Update metadata periodically
          await writeDB('metadata', id, {
            ...meta,
            status: 'downloading',
            downloadedChunks,
          });
        } else if (!job.cancelled && !job.paused) {
          // Worker failed to download segment after 3 retries
          job.paused = true;
          setDownloads((prev) =>
            prev.map((d) => (d.id === id ? { ...d, status: 'failed', speed: 'Failed' } : d))
          );
          await writeDB('metadata', id, { ...meta, status: 'failed' });
          break;
        }
      }

      activeWorkers--;
      if (activeWorkers === 0 && !job.cancelled && !job.paused) {
        // All workers finished successfully!
        compileAndSaveFile(id, meta);
      }
    };

    // Spawn workers
    for (let i = 0; i < workerCount; i++) {
      runWorker();
    }
  };

  // Compile chunks in order into a single blob and save
  const compileAndSaveFile = async (id: string, meta: any) => {
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'downloading', progress: 99, speed: 'Saving...' } : d))
    );

    try {
      const { totalChunks, title, subtitle } = meta;
      const chunks: ArrayBuffer[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const cacheKey = `${id}_${i}`;
        const buffer = await readDB('chunks', cacheKey);
        if (!buffer) {
          throw new Error(`Missing chunk index ${i}`);
        }
        chunks.push(buffer);
      }

      // Combine chunks
      const blob = new Blob(chunks, { type: 'video/mp2t' });
      const downloadUrl = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${title} - ${subtitle}.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Mark completed
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'completed', progress: 100, speed: 'Saved' } : d))
      );

      // Clean up metadata & chunks from database
      await deleteDB('metadata', id);
      for (let i = 0; i < totalChunks; i++) {
        await deleteDB('chunks', `${id}_${i}`);
      }
    } catch (e) {
      console.error('Failed to compile chunks:', e);
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'failed', speed: 'Error' } : d))
      );
    }
  };

  const pauseDownload = async (id: string) => {
    const job = activeJobsRef.current[id];
    if (job) {
      job.paused = true;
    }

    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'paused', speed: 'Paused' } : d))
    );

    const meta = await readDB('metadata', id);
    if (meta) {
      await writeDB('metadata', id, { ...meta, status: 'paused' });
    }
  };

  const resumeDownload = async (id: string) => {
    activeJobsRef.current[id] = { cancelled: false, paused: false };
    speedTrackerRef.current[id] = { bytesDownloaded: 0, lastTime: Date.now() };

    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'downloading', speed: 'Resuming...' } : d))
    );

    const meta = await readDB('metadata', id);
    if (meta) {
      await writeDB('metadata', id, { ...meta, status: 'downloading' });
      downloadChunks(id, meta);
    }
  };

  const cancelDownload = async (id: string) => {
    const job = activeJobsRef.current[id];
    if (job) {
      job.cancelled = true;
    }

    setDownloads((prev) => prev.filter((d) => d.id !== id));

    const meta = await readDB('metadata', id);
    if (meta) {
      await deleteDB('metadata', id);
      const total = meta.totalChunks || 0;
      for (let i = 0; i < total; i++) {
        await deleteDB('chunks', `${id}_${i}`);
      }
    }
  };

  const clearCompleted = () => {
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed' && d.status !== 'failed' && d.status !== 'cancelled'));
  };

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        startDownload,
        pauseDownload,
        resumeDownload,
        cancelDownload,
        clearCompleted,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
}
