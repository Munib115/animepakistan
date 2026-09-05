'use client';

import React, { useState } from 'react';
import { useDownloads } from '@/context/DownloadContext';

export default function DownloadManager() {
  const { downloads, pauseDownload, resumeDownload, cancelDownload, clearCompleted } = useDownloads();
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = downloads.filter((d) => d.status === 'downloading').length;

  return (
    <>
      {/* Floating Action Button (FAB) Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="download-fab"
        aria-label="Open Download Manager"
        title="ڈاؤنلوڈ منیجر (Download Manager)"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
          download_for_offline
        </span>
        {activeCount > 0 && (
          <span
            className="fab-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '10px',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              animation: 'pulse 1.5s infinite',
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Styled JSX for animations & hover effects */}
      <style jsx global>{`
        .download-fab {
          position: fixed;
          bottom: 84px; /* Mobile tab dock offset */
          right: 24px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: transparent;
          color: var(--color-primary, #006633);
          border: none;
          box-shadow: none;
          display: flex;
          align-items: center;
          justifyContent: center;
          cursor: pointer;
          z-index: 99990;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (min-width: 768px) {
          .download-fab {
            bottom: 24px; /* Desktop lower floating position */
          }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .download-fab:hover {
          transform: translateY(-4px) scale(1.1);
          color: var(--color-primary-dark, #004d26);
        }
        .download-sidebar {
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.15);
        }
        .download-item-card {
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .download-item-card:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 102, 51, 0.15) !important;
        }
        .control-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.06);
          background: #f8fafc;
          color: #475569;
          display: flex;
          alignItems: center;
          justifyContent: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .control-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          transform: scale(1.05);
        }
        .control-btn.danger:hover {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fca5a5;
        }
        .control-btn.success:hover {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #86efac;
        }
      `}</style>

      {/* Sliding Sidebar Panel */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 16, 8, 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99995,
          }}
        >
          <div
            className="download-sidebar"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '420px',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid var(--glass-border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 99999,
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid rgba(0, 102, 51, 0.08)',
                paddingBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
                  download_for_offline
                </span>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    ڈاؤنلوڈ منیجر
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    Download Manager
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Clear Button */}
            {downloads.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button
                  onClick={clearCompleted}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#64748b',
                    background: 'rgba(0,0,0,0.04)',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Clear Finished
                </button>
              </div>
            )}

            {/* Downloads List */}
            <div
              style={{
                flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '4px',
              }}
            >
              {downloads.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '60%',
                    color: '#94a3b8',
                    textAlign: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1' }}>
                    download_done
                  </span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    کوئی فعال ڈاؤنلوڈ نہیں ہے
                  </p>
                  <span style={{ fontSize: '0.75rem' }}>No active downloads</span>
                </div>
              ) : (
                downloads.map((item) => {
                  const isCompleted = item.status === 'completed';
                  const isDownloading = item.status === 'downloading';
                  const isPaused = item.status === 'paused';
                  const isFailed = item.status === 'failed';

                  return (
                    <div
                      key={item.id}
                      className="download-item-card"
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--glass-border)',
                        background: 'var(--bg-secondary)',
                        boxShadow: '0 4px 12px rgba(0, 102, 51, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {/* Title Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ minWidth: 0, flexGrow: 1 }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </h4>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                            {item.subtitle}
                          </p>
                        </div>

                        {/* Status Label */}
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            background: isCompleted
                              ? 'rgba(22, 163, 74, 0.1)'
                              : isFailed
                              ? 'rgba(239, 68, 68, 0.1)'
                              : isPaused
                              ? 'rgba(100, 116, 139, 0.1)'
                              : 'rgba(0, 102, 51, 0.1)',
                            color: isCompleted
                              ? '#16a34a'
                              : isFailed
                              ? '#ef4444'
                              : isPaused
                              ? '#64748b'
                              : 'var(--color-primary)',
                          }}
                        >
                          {isCompleted ? 'Saved' : isPaused ? 'Paused' : isFailed ? 'Failed' : 'Downloading'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <span>{item.progress}%</span>
                          <span>
                            {item.downloadedMB} MB / {item.totalMB > 0 ? `${item.totalMB} MB` : 'Estimating...'}
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '4px',
                            background: 'var(--bg-tertiary)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${item.progress}%`,
                              height: '100%',
                              background: isCompleted ? '#16a34a' : isFailed ? '#ef4444' : 'var(--color-primary)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Speed & Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--glass-border)',
                          paddingTop: '8px',
                        }}
                      >
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                          {isDownloading && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>speed</span>
                              {item.speed}
                            </span>
                          )}
                        </span>

                        {/* Controls */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isDownloading && (
                            <button
                              onClick={() => pauseDownload(item.id)}
                              className="control-btn"
                              title="Pause"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>pause</span>
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => resumeDownload(item.id)}
                              className="control-btn success"
                              title="Resume"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>play_arrow</span>
                            </button>
                          )}
                          {(isDownloading || isPaused) && (
                            <button
                              onClick={() => cancelDownload(item.id)}
                              className="control-btn danger"
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                          )}
                          {(isCompleted || isFailed) && (
                            <button
                              onClick={() => cancelDownload(item.id)}
                              className="control-btn danger"
                              title="Delete/Remove"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
