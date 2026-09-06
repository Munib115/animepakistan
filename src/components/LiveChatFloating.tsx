'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { getGuestProfile, updateGuestName, GuestProfile } from '@/lib/guestIdentity';
import { sound } from '@/lib/soundEngine';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  avatar_color: string;
  message_type: 'text' | 'voice' | 'image' | 'video';
  content?: string | null;
  media_url?: string | null;
  media_duration?: number;
  created_at: string;
}

const INITIAL_FALLBACK_MESSAGES: ChatMessage[] = [];

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function LiveChatFloating() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_FALLBACK_MESSAGES);
  const [guest, setGuest] = useState<GuestProfile>({
    id: 'guest_init',
    name: 'Guest Otaku',
    avatarColor: '#00ff66',
    initials: 'GO',
  });
  const [textInput, setTextInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Persistent refs to avoid tearing down realtime subscription on state changes
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const guestRef = useRef(guest);
  guestRef.current = guest;

  const lastSeenTimeRef = useRef<string>('');

  // Media Attachment State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lightbox view for images
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Client hydration check & initialize last seen timestamp
  useEffect(() => {
    setMounted(true);
    const profile = getGuestProfile();
    setGuest(profile);
    guestRef.current = profile;
    setCustomNameInput(profile.name);

    try {
      const storedLastSeen = localStorage.getItem('ap_chat_last_seen_time');
      if (storedLastSeen) {
        lastSeenTimeRef.current = storedLastSeen;
      } else {
        const nowIso = new Date().toISOString();
        localStorage.setItem('ap_chat_last_seen_time', nowIso);
        lastSeenTimeRef.current = nowIso;
      }
    } catch (e) {
      lastSeenTimeRef.current = new Date().toISOString();
    }
  }, []);

  // Scroll to latest message
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Fetch initial messages & subscribe to Supabase Realtime + Polling fallback
  useEffect(() => {
    if (!mounted) return;
    let isSubscribed = true;

    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from('live_chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(100);

        if (!error && data && isSubscribed) {
          const list = data as ChatMessage[];
          setMessages(list);

          // Realtime unread count calculation when inbox is closed
          if (!isOpenRef.current && lastSeenTimeRef.current) {
            const lastSeenTs = new Date(lastSeenTimeRef.current).getTime();
            const newIncoming = list.filter((m) => {
              const msgTs = new Date(m.created_at).getTime();
              return m.sender_id !== guestRef.current.id && msgTs > lastSeenTs;
            });
            setUnreadCount(newIncoming.length);
          }
        }
      } catch (err) {}
    }

    loadMessages();

    // Subscribe to Realtime Postgres Changes
    const channel = supabase
      .channel('public:live_chat_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Sound alert & realtime unread count increment if message from another user
          if (newMsg.sender_id !== guestRef.current.id) {
            if (isOpenRef.current) {
              lastSeenTimeRef.current = newMsg.created_at;
              try {
                localStorage.setItem('ap_chat_last_seen_time', newMsg.created_at);
              } catch (e) {}
              setUnreadCount(0);
            } else {
              sound.notification();
              sound.haptic([15, 30, 20]);
              setUnreadCount((c) => c + 1);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadMessages();
        }
      });

    // 4-second background sync guarantees real-time delivery across all browsers and devices
    const pollInterval = setInterval(() => {
      loadMessages();
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [mounted]);

  // Mark messages as seen when user opens chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      const latest = messages.length > 0 ? messages[messages.length - 1].created_at : new Date().toISOString();
      lastSeenTimeRef.current = latest;
      try {
        localStorage.setItem('ap_chat_last_seen_time', latest);
      } catch (e) {}
      scrollToBottom('instant');
    }
  }, [isOpen, messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('smooth');
    }
  }, [messages.length, isOpen, scrollToBottom]);

  // Toggle chat inbox
  const toggleChat = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      sound.buttonPop();
      sound.haptic(18);
    } catch (err) {}
    setIsOpen((prev) => !prev);
  };

  // Save updated guest name
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNameInput.trim()) return;
    const updated = updateGuestName(customNameInput.trim());
    setGuest(updated);
    setIsEditingName(false);
    sound.softClick();
    sound.haptic(10);
  };

  // Handle File Selection for Image / Video
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.softClick();
    sound.haptic(12);

    if (file.type.startsWith('image/')) {
      setMediaType('image');
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreviewUrl(url);
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreviewUrl(url);
    }
  };

  const clearSelectedFile = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setSelectedFile(null);
    setMediaPreviewUrl(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    sound.softClick();
  };

  // Voice Note Recording
  const startRecording = async () => {
    sound.buttonPop();
    sound.haptic(20);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or not supported on this device.');
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    sound.softClick();
    sound.haptic(15);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    sound.buttonPop();
    sound.haptic(25);

    const duration = recordingSeconds;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setIsSending(true);

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `voice_${guest.id}_${Date.now()}.webm`;

        let mediaUrl = '';
        try {
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('chat_media')
            .upload(fileName, audioBlob, { contentType: 'audio/webm' });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('chat_media')
              .getPublicUrl(uploadData.path);
            mediaUrl = publicUrlData.publicUrl;
          }
        } catch (e) {}

        // Fallback to base64 data URL
        if (!mediaUrl) {
          mediaUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audioBlob);
          });
        }

        const newMsg: ChatMessage = {
          id: generateUUID(),
          sender_id: guest.id,
          sender_name: guest.name,
          avatar_color: guest.avatarColor,
          message_type: 'voice',
          content: null,
          media_url: mediaUrl,
          media_duration: Math.max(1, duration),
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, newMsg]);
        sound.successChime();

        const { error: insertErr } = await supabase.from('live_chat_messages').insert([newMsg]);
        if (insertErr) {
          console.error('[LiveChat] Supabase voice insert error:', insertErr);
        }
      } catch (err) {
        console.error('Error sending voice message:', err);
      } finally {
        setIsSending(false);
      }
    };

    recorder.stop();
  };

  // Send Text or Media Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !selectedFile) || isSending) return;

    sound.buttonPop();
    sound.haptic(15);
    setIsSending(true);

    try {
      let uploadedMediaUrl: string | null = null;
      let finalMessageType: 'text' | 'image' | 'video' = 'text';

      if (selectedFile && mediaType) {
        finalMessageType = mediaType;
        const fileExt = selectedFile.name.split('.').pop() || 'bin';
        const fileName = `${mediaType}_${guest.id}_${Date.now()}.${fileExt}`;

        try {
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('chat_media')
            .upload(fileName, selectedFile);

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('chat_media')
              .getPublicUrl(uploadData.path);
            uploadedMediaUrl = publicUrlData.publicUrl;
          }
        } catch (e) {}

        if (!uploadedMediaUrl) {
          uploadedMediaUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(selectedFile);
          });
        }
      }

      const newMsg: ChatMessage = {
        id: generateUUID(),
        sender_id: guest.id,
        sender_name: guest.name,
        avatar_color: guest.avatarColor,
        message_type: finalMessageType,
        content: textInput.trim() || null,
        media_url: uploadedMediaUrl,
        media_duration: 0,
        created_at: new Date().toISOString(),
      };

      setTextInput('');
      clearSelectedFile();

      setMessages((prev) => [...prev, newMsg]);
      sound.softClick();

      const { error: insertErr } = await supabase.from('live_chat_messages').insert([newMsg]);
      if (insertErr) {
        console.error('[LiveChat] Supabase message insert error:', insertErr);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Play audio note
  const togglePlayAudio = (id: string, url: string) => {
    sound.softClick();
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      setPlayingAudioId(id);
    }
  };

  const formatSeconds = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          1. FLOATING GREEN MESSENGER BUTTON (Compact & Professional)
      ══════════════════════════════════════════════════════════════════════ */}
      <button
        id="ap-live-messenger-btn"
        type="button"
        onClick={toggleChat}
        aria-label="Open Community Live Chat"
        className={`ap-messenger-floating-btn ${isOpen ? 'is-active' : ''}`}
        title="Live Community Chat | لائیو چیٹ"
      >
        <span className="ap-messenger-glow-ring" />
        <span className="ap-messenger-pulse-core" />

        {/* Compact Professional Material Symbol icon */}
        <span 
          className="material-symbols-outlined" 
          style={{ 
            fontSize: '22px', 
            color: '#021a0d',
            transform: isOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            userSelect: 'none',
          }}
        >
          {isOpen ? 'close' : 'chat'}
        </span>

        {/* Realtime Unread Messages Badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="ap-messenger-unread-badge" aria-label={`${unreadCount} new messages`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        <span className="ap-messenger-online-dot" />
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          2. MOBILE BACKDROP
      ══════════════════════════════════════════════════════════════════════ */}
      <div 
        className={`ap-chat-backdrop ${isOpen ? 'is-open' : 'is-closed'}`}
        onClick={toggleChat}
        aria-hidden={!isOpen}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          3. FLOATING LIVE CHAT INBOX DRAWER (Curvy Design)
      ══════════════════════════════════════════════════════════════════════ */}
      <div 
        className={`ap-chat-inbox-container ${isOpen ? 'is-open' : 'is-closed'}`}
        aria-hidden={!isOpen}
      >
        {/* INBOX HEADER */}
        <div className="ap-chat-header">
          <div className="ap-chat-header-info">
            <div className="ap-chat-live-badge">
              <span className="ap-chat-green-beacon" />
              <span className="ap-chat-live-text">LIVE CHAT</span>
            </div>
            <div>
              <h3 className="ap-chat-title">
                <span>Anime</span> Pakistan Lounge
              </h3>
              <p className="ap-chat-subtitle">
                لائیو چیٹ • Urdu & Hindi Anime Community
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleChat}
            className="ap-chat-close-btn"
            aria-label="Minimize Chat"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              expand_more
            </span>
          </button>
        </div>

        {/* GUEST USER IDENTITY STRIP */}
        <div className="ap-chat-user-strip">
          <div className="ap-chat-user-left">
            <div 
              className="ap-chat-user-avatar"
              style={{ background: guest.avatarColor }}
            >
              {guest.initials}
            </div>
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="ap-chat-edit-name-form">
                <input
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  maxLength={20}
                  autoFocus
                  className="ap-chat-name-input"
                />
                <button type="submit" className="ap-chat-name-save-btn">
                  ✓
                </button>
              </form>
            ) : (
              <div className="ap-chat-name-display" onClick={() => setIsEditingName(true)}>
                <span className="ap-chat-username">{guest.name}</span>
                <span className="material-symbols-outlined ap-chat-pencil">edit</span>
              </div>
            )}
          </div>
          <span className="ap-chat-active-count">
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00ff66',
              boxShadow: '0 0 6px #00ff66',
              display: 'inline-block',
            }} />
            <span>Online</span>
          </span>
        </div>

        {/* MESSAGE STREAM */}
        <div className="ap-chat-messages-scroll">
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 16px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.55)',
              gap: '6px',
            }}>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                No messages yet. Send a message to start chatting!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === guest.id;
              return (
                <div
                  key={msg.id}
                  className={`ap-chat-msg-row ${isMe ? 'msg-me' : 'msg-them'}`}
                >
                  {!isMe && (
                    <div
                      className="ap-msg-avatar"
                      style={{ background: msg.avatar_color || '#10b981' }}
                    >
                      {msg.sender_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="ap-msg-bubble-wrapper">
                    {!isMe && (
                      <span className="ap-msg-sender-name">
                        {msg.sender_name}
                      </span>
                    )}

                  {/* ULTRA CURVY DESIGN CHAT BUBBLE */}
                  <div className={`ap-msg-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`}>
                    {msg.content && (
                      <p className="ap-msg-text">{msg.content}</p>
                    )}

                    {msg.message_type === 'voice' && msg.media_url && (
                      <div className="ap-voice-player">
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(msg.id, msg.media_url!)}
                          className="ap-voice-play-btn"
                          aria-label={playingAudioId === msg.id ? 'Pause Voice' : 'Play Voice'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {playingAudioId === msg.id ? 'pause' : 'play_arrow'}
                          </span>
                        </button>
                        <div className="ap-voice-waveform">
                          <div className={`ap-voice-bars ${playingAudioId === msg.id ? 'is-playing' : ''}`}>
                            <span style={{ height: '60%' }} />
                            <span style={{ height: '100%' }} />
                            <span style={{ height: '40%' }} />
                            <span style={{ height: '80%' }} />
                            <span style={{ height: '50%' }} />
                            <span style={{ height: '90%' }} />
                            <span style={{ height: '70%' }} />
                            <span style={{ height: '30%' }} />
                          </div>
                          <span className="ap-voice-duration">
                            {formatSeconds(msg.media_duration)}
                          </span>
                        </div>
                      </div>
                    )}

                    {msg.message_type === 'image' && msg.media_url && (
                      <div 
                        className="ap-chat-image-wrap"
                        onClick={() => setLightboxUrl(msg.media_url!)}
                      >
                        <img
                          src={msg.media_url}
                          alt="Attachment"
                          className="ap-chat-image"
                          loading="lazy"
                        />
                        <div className="ap-chat-image-zoom-hint">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>zoom_in</span>
                        </div>
                      </div>
                    )}

                    {msg.message_type === 'video' && msg.media_url && (
                      <div className="ap-chat-video-wrap">
                        <video
                          src={msg.media_url}
                          controls
                          playsInline
                          preload="metadata"
                          className="ap-chat-video"
                        />
                      </div>
                    )}

                    <span className="ap-msg-time">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }))}
          <div ref={messagesEndRef} />
        </div>

        {/* PENDING MEDIA PREVIEW TRAY */}
        {mediaPreviewUrl && (
          <div className="ap-media-preview-tray">
            <div className="ap-preview-thumb-wrap">
              {mediaType === 'image' ? (
                <img src={mediaPreviewUrl} alt="Preview" className="ap-preview-thumb" />
              ) : (
                <video src={mediaPreviewUrl} className="ap-preview-thumb" />
              )}
              <button
                type="button"
                onClick={clearSelectedFile}
                className="ap-preview-remove-btn"
                title="Remove attachment"
              >
                ✕
              </button>
            </div>
            <div className="ap-preview-info">
              <span className="ap-preview-type">
                {mediaType === 'image' ? '📸 Photo attached' : '🎬 Video attached'}
              </span>
              <span className="ap-preview-filename">
                {selectedFile?.name}
              </span>
            </div>
          </div>
        )}

        {/* LIVE VOICE RECORDING TRAY */}
        {isRecording && (
          <div className="ap-voice-recording-tray">
            <div className="ap-recording-pulse">
              <span className="ap-rec-dot" />
              <span className="ap-rec-time">{formatSeconds(recordingSeconds)}</span>
            </div>
            <div className="ap-rec-visualizer">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="ap-rec-actions">
              <button
                type="button"
                onClick={cancelRecording}
                className="ap-rec-cancel-btn"
                title="Cancel recording"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="ap-rec-send-btn"
                title="Send voice note"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
              </button>
            </div>
          </div>
        )}

        {/* CURVY INPUT CONTROLS DOCK */}
        {!isRecording && (
          <form onSubmit={handleSendMessage} className="ap-chat-input-dock">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ap-chat-tool-btn"
              title="Send Photo or Video"
              disabled={isSending}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                add_photo_alternate
              </span>
            </button>

            <button
              type="button"
              onClick={startRecording}
              className="ap-chat-tool-btn ap-mic-btn"
              title="Hold/Tap to Record Voice Note"
              disabled={isSending}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                mic
              </span>
            </button>

            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type message in Urdu or English..."
              className="ap-chat-text-input"
              disabled={isSending}
            />

            <button
              type="submit"
              disabled={(!textInput.trim() && !selectedFile) || isSending}
              className="ap-chat-send-btn"
              title="Send Message"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {isSending ? 'hourglass_top' : 'arrow_upward'}
              </span>
            </button>
          </form>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. FULLSCREEN IMAGE LIGHTBOX
      ══════════════════════════════════════════════════════════════════════ */}
      {lightboxUrl && (
        <div 
          className="ap-lightbox-overlay"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            type="button"
            className="ap-lightbox-close"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged media"
            className="ap-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>,
    document.body
  );
}
