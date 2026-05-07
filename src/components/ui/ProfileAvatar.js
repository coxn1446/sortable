import React, { useEffect, useState } from 'react';

import { getDefaultAvatarColor, getDefaultAvatarEmoji } from '../../helpers/avatarHelpers';

const sizeClass = {
  sm: 'h-8 w-8 min-h-8 min-w-8',
  md: 'h-11 w-11 min-h-11 min-w-11',
  lg: 'h-28 w-28 min-h-28 min-w-28 sm:h-32 sm:w-32 sm:min-h-32 sm:min-w-32',
};

const emojiClass = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-4xl sm:text-5xl',
};

/**
 * Avatar image when `profile_picture` is set, else the same default as Aurasphere `UserAvatar`
 * (animal emoji + palette background from `avatarHelpers`).
 */
export default function ProfileAvatar({
  userId,
  username = '',
  profilePicture = null,
  size = 'md',
  className = '',
}) {
  const [failed, setFailed] = useState(false);
  const dim = sizeClass[size] || sizeClass.md;
  const em = emojiClass[size] || emojiClass.md;
  const label = username ? `${username} avatar` : 'User avatar';

  useEffect(() => {
    setFailed(false);
  }, [profilePicture]);

  const emoji = getDefaultAvatarEmoji(userId);
  const bgColor = getDefaultAvatarColor(userId);

  if (profilePicture && !failed) {
    return (
      <img
        src={profilePicture}
        alt={label}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dim} rounded-full border border-white/15 object-cover ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`${dim} flex select-none items-center justify-center rounded-full border border-white/15 shadow-soft ${className}`.trim()}
      style={{ backgroundColor: bgColor }}
      data-testid="profile-avatar-default"
      aria-label={label}
    >
      <span role="img" aria-hidden="true" className={em}>
        {emoji}
      </span>
    </div>
  );
}
