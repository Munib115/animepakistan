// Persistent Unique Guest Identity System

const ADJECTIVES = ['Silent', 'Shadow', 'Dragon', 'Crimson', 'Neon', 'Cosmic', 'Solar', 'Phantom', 'Mystic', 'Blazing', 'Cyber', 'Apex'];
const NOUNS = ['Ninja', 'Otaku', 'Samurai', 'Shinobi', 'Titan', 'Ronin', 'Gamer', 'Hunter', 'Knight', 'Hero', 'Sensei', 'Champion'];
const AVATAR_COLORS = ['#00ff66', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export interface GuestProfile {
  id: string;
  name: string;
  avatarColor: string;
  initials: string;
}

export function getGuestProfile(): GuestProfile {
  if (typeof window === 'undefined') {
    return {
      id: 'guest_default',
      name: 'Guest Otaku',
      avatarColor: '#00cc66',
      initials: 'GO',
    };
  }

  try {
    const savedId = localStorage.getItem('ap_guest_id');
    const savedName = localStorage.getItem('ap_guest_name');
    const savedColor = localStorage.getItem('ap_guest_color');

    if (savedId && savedName && savedColor && !savedName.includes('Thunder')) {
      return {
        id: savedId,
        name: savedName,
        avatarColor: savedColor,
        initials: savedName.slice(0, 2).toUpperCase(),
      };
    }

    // Generate new unique guest profile
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const generatedName = `${adj} ${noun} #${randomNum}`;
    const generatedId = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    localStorage.setItem('ap_guest_id', generatedId);
    localStorage.setItem('ap_guest_name', generatedName);
    localStorage.setItem('ap_guest_color', randomColor);

    return {
      id: generatedId,
      name: generatedName,
      avatarColor: randomColor,
      initials: `${adj[0]}${noun[0]}`,
    };
  } catch (e) {
    return {
      id: 'guest_fallback',
      name: 'Anime Fan #1001',
      avatarColor: '#00cc66',
      initials: 'AF',
    };
  }
}

export function updateGuestName(newName: string): GuestProfile {
  const profile = getGuestProfile();
  const trimmed = newName.trim() || profile.name;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ap_guest_name', trimmed);
    } catch (e) {}
  }
  return {
    ...profile,
    name: trimmed,
    initials: trimmed.slice(0, 2).toUpperCase(),
  };
}
