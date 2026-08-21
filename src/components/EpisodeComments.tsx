'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getGuestProfile, updateGuestName, GuestProfile } from '@/lib/guestIdentity';
import { sound } from '@/lib/soundEngine';

export interface CommentItem {
  id: string;
  anime_slug: string;
  episode_slug: string;
  guest_id: string;
  guest_name: string;
  avatar_seed?: string;
  content?: string;
  audio_url?: string;
  audio_duration?: number;
  likes: number;
  created_at: string;
}

interface EpisodeCommentsProps {
  animeSlug: string;
  episodeSlug: string;
  episodeTitle?: string;
}

export default function EpisodeComments({ animeSlug, episodeSlug, episodeTitle }: EpisodeCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [textInput, setTextInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  // Voice recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load guest profile on client
  useEffect(() => {
    const profile = getGuestProfile();
    setGuest(profile);
    setNewName(profile.name);
  }, []);

  // Fetch comments from Supabase
  useEffect(() => {
    async function loadComments() {
      setLoading(true);
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('episode_comments')
          .select('*')
          .eq('anime_slug', animeSlug)
          .eq('episode_slug', episodeSlug)
          .order('created_at', { ascending: false });

        if (data && !error) {
          setComments(data as CommentItem[]);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        setLoading(false);
      }
    }

    loadComments();
  }, [animeSlug, episodeSlug]);

  // Voice note timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  // Start voice recording
  const startRecording = async () => {
    try {
      sound.playButton();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access is needed to record voice messages.');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      sound.playButton();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cancel voice recording
  const cancelAudio = () => {
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
  };

  // Submit comment (text and/or audio)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !audioBlob) return;
    if (!guest) return;

    setSubmitting(true);
    sound.playCardClick();

    let uploadedAudioUrl: string | undefined = undefined;

    try {
      // 1. Upload audio if present
      if (audioBlob && supabase) {
        const fileName = `${animeSlug}_${episodeSlug}_${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('comment_audio')
          .upload(fileName, audioBlob, { contentType: 'audio/webm' });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('comment_audio')
            .getPublicUrl(fileName);
          uploadedAudioUrl = publicUrlData?.publicUrl;
        }
      }

      // Fallback base64 audio if storage bucket is not configured
      if (audioBlob && !uploadedAudioUrl) {
        uploadedAudioUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const newComment: Partial<CommentItem> = {
        anime_slug: animeSlug,
        episode_slug: episodeSlug,
        guest_id: guest.id,
        guest_name: guest.name,
        avatar_seed: guest.avatarColor,
        content: textInput.trim() || undefined,
        audio_url: uploadedAudioUrl,
        audio_duration: recordingSeconds > 0 ? recordingSeconds : undefined,
        likes: 0,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('episode_comments')
          .insert([newComment])
          .select()
          .single();

        if (data && !error) {
          setComments((prev) => [data as CommentItem, ...prev]);
        } else {
          // Optimistic local add
          setComments((prev) => [{ ...newComment, id: `local_${Date.now()}` } as CommentItem, ...prev]);
        }
      } else {
        // Local preview
        setComments((prev) => [{ ...newComment, id: `local_${Date.now()}` } as CommentItem, ...prev]);
      }

      // Reset form
      setTextInput('');
      cancelAudio();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Like comment
  const handleLike = async (commentId: string) => {
    if (likedMap[commentId]) return;
    sound.playButton();
    setLikedMap((prev) => ({ ...prev, [commentId]: true }));

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c))
    );

    if (supabase) {
      try {
        const comment = comments.find((c) => c.id === commentId);
        const newLikes = (comment?.likes || 0) + 1;
        await supabase.from('episode_comments').update({ likes: newLikes }).eq('id', commentId);
      } catch (e) {}
    }
  };

  // Save updated nickname
  const handleSaveName = () => {
    if (newName.trim()) {
      const updated = updateGuestName(newName.trim());
      setGuest(updated);
      setIsEditingName(false);
      sound.playButton();
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px 20px', marginTop: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--color-primary)' }}>
            forum
          </span>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Episode Discussions & Voice Notes
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {comments.length} {comments.length === 1 ? 'Message' : 'Messages'}
            </span>
          </div>
        </div>

        {/* Guest Profile Badge */}
        {guest && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 102, 51, 0.08)',
            padding: '5px 12px',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: guest.avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}>
              {guest.initials}
            </div>

            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={24}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-primary)',
                    background: '#ffffff',
                    width: '130px',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  style={{
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {guest.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  title="Change Guest Nickname"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comment Input Box */}
      <form onSubmit={handleSubmit} style={{
        background: '#ffffff',
        border: '1.5px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 102, 51, 0.06)',
      }}>
        <textarea
          rows={3}
          placeholder="Write your thoughts on this episode, share your favorite moment, or record a voice note..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          className="glass-input"
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            background: 'transparent',
            padding: '4px',
            fontSize: '0.88rem',
            outline: 'none',
          }}
        />

        {/* Audio Preview if recorded */}
        {audioPreviewUrl && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(0, 102, 51, 0.08)',
            padding: '8px 12px',
            borderRadius: '10px',
            marginTop: '10px',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
              mic
            </span>
            <audio src={audioPreviewUrl} controls style={{ height: '32px', flexGrow: 1 }} />
            <button
              type="button"
              onClick={cancelAudio}
              style={{
                border: 'none',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        )}

        {/* Bottom Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(0, 102, 51, 0.08)',
        }}>
          {/* Audio Recorder Controls */}
          <div>
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0, 102, 51, 0.05)',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mic</span>
                <span>Record Audio</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  animation: 'pulse 1.2s infinite',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop_circle</span>
                <span>Stop Recording ({recordingSeconds}s)</span>
              </button>
            )}
          </div>

          {/* Post Button */}
          <button
            type="submit"
            disabled={submitting || (!textInput.trim() && !audioBlob)}
            className="glass-btn"
            style={{
              padding: '7px 18px',
              fontSize: '0.82rem',
              fontWeight: 800,
              opacity: (!textInput.trim() && !audioBlob) || submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Loading discussion...
          </div>
        ) : comments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'rgba(0, 102, 51, 0.03)',
            borderRadius: '12px',
            border: '1px dashed var(--glass-border)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-primary)', opacity: 0.7 }}>
              chat_bubble
            </span>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              Be the first to share your opinion or voice note on this episode!
            </p>
          </div>
        ) : (
          comments.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
            >
              {/* Author & Timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: item.avatar_seed || '#00cc66',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 900,
                  }}>
                    {item.guest_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {item.guest_name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => handleLike(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    background: likedMap[item.id] ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 102, 51, 0.05)',
                    color: likedMap[item.id] ? '#ef4444' : 'var(--text-muted)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {likedMap[item.id] ? 'favorite' : 'favorite_border'}
                  </span>
                  <span>{item.likes || 0}</span>
                </button>
              </div>

              {/* Text Message Content */}
              {item.content && (
                <p style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  margin: '4px 0 8px 42px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {item.content}
                </p>
              )}

              {/* Audio Voice Note Player */}
              {item.audio_url && (
                <div style={{
                  marginLeft: '42px',
                  marginTop: '8px',
                  background: 'rgba(0, 102, 51, 0.05)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  maxWidth: '100%',
                }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
                    mic
                  </span>
                  <audio src={item.audio_url} controls style={{ height: '28px', maxWidth: '280px' }} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
