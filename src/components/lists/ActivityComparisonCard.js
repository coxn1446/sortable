import React from 'react';
import { Link } from 'react-router-dom';

import Card from '../ui/Card';
import { listRoutePath } from '../../helpers/listRoutePaths';

function timeAgo(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function ActivityComparisonCard({ comparison }) {
  const c = comparison;
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex flex-col gap-1">
        <Link
          to={listRoutePath(String(c.list_id))}
          className="text-xs uppercase tracking-wide text-sortable-highlight hover:underline"
        >
          {c.list_title}
        </Link>
        <div className="text-sm">
          <span className="font-semibold">{c.winner_label}</span>
          <span className="mx-2 text-sortable-text-secondary">over</span>
          <span className="text-sortable-text-secondary line-through">{c.loser_label}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs text-sortable-text-secondary">{timeAgo(c.created_at)}</span>
    </Card>
  );
}
