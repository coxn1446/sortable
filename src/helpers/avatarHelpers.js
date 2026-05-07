/**
 * Default avatars: same deterministic animal emoji + hex background as Aurasphere
 * (`aurasphere/src/helpers/usersHelpers.js` — `DEFAULT_AVATAR_*`, `getDefaultAvatarEmoji`, `getDefaultAvatarColor`).
 */

export const DEFAULT_AVATAR_EMOJIS = [
  '🦊',
  '🦁',
  '🐯',
  '🐨',
  '🐼',
  '🐸',
  '🦉',
  '🦄',
  '🐙',
  '🦋',
  '🐢',
  '🐝',
  '🐳',
  '🦜',
  '🐧',
  '🦩',
];

export const DEFAULT_AVATAR_COLORS = ['#6B8CFF', '#8B7CFF', '#5FA8A1', '#FF6B6B', '#4ECDC4', '#FF8B94'];

function hashUserId(userId) {
  const n = Number(userId);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.floor(Math.abs(Math.sin(n + 1) * 10000)) || 0;
}

export function getDefaultAvatarEmoji(userId) {
  const hash = hashUserId(userId);
  return DEFAULT_AVATAR_EMOJIS[hash % DEFAULT_AVATAR_EMOJIS.length];
}

export function getDefaultAvatarColor(userId) {
  const hash = hashUserId(userId);
  return DEFAULT_AVATAR_COLORS[
    Math.floor(hash / DEFAULT_AVATAR_EMOJIS.length) % DEFAULT_AVATAR_COLORS.length
  ];
}
