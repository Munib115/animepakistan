-- ==============================================================================
-- ANIME PAKISTAN (AP) - COMPLETE SUPABASE SCHEMA
-- (Episode Comments, Voice Notes, and Shared Libraries by Code)
-- Paste this entire SQL into your Supabase Dashboard -> SQL Editor and click RUN
-- ==============================================================================

-- 1. Create episode_comments table
CREATE TABLE IF NOT EXISTS public.episode_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anime_slug TEXT NOT NULL,
    episode_slug TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    avatar_seed TEXT DEFAULT 'ninja',
    content TEXT,
    audio_url TEXT,
    audio_duration INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index for ultra-fast query lookups by anime and episode
CREATE INDEX IF NOT EXISTS idx_comments_anime_episode 
ON public.episode_comments(anime_slug, episode_slug, created_at DESC);

-- 3. Enable Row Level Security (RLS) for episode comments
ALTER TABLE public.episode_comments ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone (guests & users) to read comments
DROP POLICY IF EXISTS "Allow public read access to episode comments" ON public.episode_comments;
CREATE POLICY "Allow public read access to episode comments"
ON public.episode_comments FOR SELECT
USING (true);

-- 5. Allow anyone to post comments & voice notes
DROP POLICY IF EXISTS "Allow public insert to episode comments" ON public.episode_comments;
CREATE POLICY "Allow public insert to episode comments"
ON public.episode_comments FOR INSERT
WITH CHECK (true);

-- 6. Allow anyone to like comments
DROP POLICY IF EXISTS "Allow public update likes on episode comments" ON public.episode_comments;
CREATE POLICY "Allow public update likes on episode comments"
ON public.episode_comments FOR UPDATE
USING (true)
WITH CHECK (true);

-- 7. Enable Realtime for episode comments so new comments appear live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'episode_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.episode_comments;
  END IF;
END $$;

-- 8. Create public storage bucket for Voice Audio recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comment_audio', 'comment_audio', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage RLS policies for voice audio bucket
DROP POLICY IF EXISTS "Allow public read audio files" ON storage.objects;
CREATE POLICY "Allow public read audio files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'comment_audio');

DROP POLICY IF EXISTS "Allow public upload audio files" ON storage.objects;
CREATE POLICY "Allow public upload audio files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'comment_audio');

-- ==============================================================================
-- 10. SHARED LIBRARIES TABLE (Share anime library via 6-digit Code)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shared_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_code TEXT UNIQUE NOT NULL,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    watchlist JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '30 days')
);

-- Fast lookup by share code
CREATE INDEX IF NOT EXISTS idx_shared_libraries_code 
ON public.shared_libraries(share_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shared_libraries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read shared libraries by entering code
DROP POLICY IF EXISTS "Allow public read shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public read shared libraries"
ON public.shared_libraries FOR SELECT
USING (true);

-- Allow anyone to publish/create a shared library
DROP POLICY IF EXISTS "Allow public create shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public create shared libraries"
ON public.shared_libraries FOR INSERT
WITH CHECK (true);

-- Allow creator or anyone with code to update their shared library snapshot
DROP POLICY IF EXISTS "Allow public update own shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public update own shared libraries"
ON public.shared_libraries FOR UPDATE
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 11. LIVE COMMUNITY CHAT (Text, Voice Notes, Photos, Videos & Realtime Sync)
-- ==============================================================================

-- Create live_chat_messages table
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#00ff66',
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image', 'video')),
    content TEXT,
    media_url TEXT,
    media_duration INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fast lookup for recent live messages
CREATE INDEX IF NOT EXISTS idx_live_chat_created_at 
ON public.live_chat_messages(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read live chat messages
DROP POLICY IF EXISTS "Allow public read live chat messages" ON public.live_chat_messages;
CREATE POLICY "Allow public read live chat messages"
ON public.live_chat_messages FOR SELECT
USING (true);

-- Allow anyone to send live chat messages
DROP POLICY IF EXISTS "Allow public insert live chat messages" ON public.live_chat_messages;
CREATE POLICY "Allow public insert live chat messages"
ON public.live_chat_messages FOR INSERT
WITH CHECK (true);

-- Enable Realtime for live_chat_messages so new chats pop in instantly
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'live_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
  END IF;
END $$;

-- Optional live_chat_presence table for presence backups
CREATE TABLE IF NOT EXISTS public.live_chat_presence (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#00ff66',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.live_chat_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read presence" ON public.live_chat_presence;
CREATE POLICY "Allow public read presence" ON public.live_chat_presence FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public upsert presence" ON public.live_chat_presence;
CREATE POLICY "Allow public upsert presence" ON public.live_chat_presence FOR ALL USING (true) WITH CHECK (true);

-- Create public storage bucket for chat media (voice notes, images, videos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for chat media bucket
DROP POLICY IF EXISTS "Allow public read chat media" ON storage.objects;
CREATE POLICY "Allow public read chat media" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat_media');

DROP POLICY IF EXISTS "Allow public upload chat media" ON storage.objects;
CREATE POLICY "Allow public upload chat media" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat_media');
