import React from 'react';

import ProfileAvatar from '../ui/ProfileAvatar';

/** One row for ranking participant picks: avatar + username (no extra copy). */
export default function ParticipantSelectOption({ userId, username, profilePicture }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ProfileAvatar
        userId={userId}
        username={username}
        profilePicture={profilePicture}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate font-medium text-sortable-text-primary">{username}</span>
    </span>
  );
}
