import {
  DEFAULT_AVATAR_COLORS,
  DEFAULT_AVATAR_EMOJIS,
  getDefaultAvatarColor,
  getDefaultAvatarEmoji,
} from '../helpers/avatarHelpers';

describe('avatarHelpers (Aurasphere-compatible defaults)', () => {
  test('emoji and color are stable per user id', () => {
    expect(getDefaultAvatarEmoji(42)).toBe(getDefaultAvatarEmoji(42));
    expect(getDefaultAvatarColor(42)).toBe(getDefaultAvatarColor(42));
  });

  test('emoji is from the Aurasphere palette', () => {
    expect(DEFAULT_AVATAR_EMOJIS).toContain(getDefaultAvatarEmoji(99));
  });

  test('color is from the Aurasphere palette', () => {
    expect(DEFAULT_AVATAR_COLORS).toContain(getDefaultAvatarColor(99));
  });

  test('varies across user ids', () => {
    const pairs = new Set();
    for (let i = 1; i <= 40; i += 1) {
      pairs.add(`${getDefaultAvatarEmoji(i)}|${getDefaultAvatarColor(i)}`);
    }
    expect(pairs.size).toBeGreaterThan(1);
  });
});
