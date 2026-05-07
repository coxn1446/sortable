import React from 'react';
import { Link } from 'react-router-dom';

import Card from '../ui/Card';

export default function ListPreviewCard({ list, ctaLabel = 'View', ctaTo, viewerUserId }) {
  const showParticipation =
    viewerUserId != null && list.owner_user_id != null && Number.isFinite(Number(viewerUserId));
  const isOwner = showParticipation && Number(list.owner_user_id) === Number(viewerUserId);
  const rankDone = !!list.my_rank_complete;

  return (
    <Card className="flex flex-col gap-3 p-5 transition-transform duration-200 ease-smooth hover:scale-102">
      <div>
        <h3 className="font-display text-lg font-semibold text-sortable-text-primary">{list.title}</h3>
        {list.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-sortable-text-secondary">{list.description}</p>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-sortable-text-secondary">
            {list.is_public ? 'Public' : 'Private'}
          </span>
          {showParticipation ? (
            <span className="text-xs text-sortable-text-secondary">
              {isOwner ? 'You own' : 'Participant'} · {rankDone ? 'Completed' : 'In progress'}
            </span>
          ) : null}
        </div>
        <Link
          to={ctaTo}
          className="shrink-0 text-sm font-semibold text-sortable-highlight hover:underline"
        >
          {ctaLabel}
        </Link>
      </div>
    </Card>
  );
}
