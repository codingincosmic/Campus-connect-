/**
 * Small shared building blocks for the role dashboards.
 *
 * Mobile-first throughout: stat tiles sit two-up on a phone and four-up on a
 * desktop, and every action is a full-width tap target on small screens.
 */
import { Link } from 'react-router-dom';
import { Badge, Card, cx } from './ui.jsx';

const TONE_TEXT = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  brand: 'text-brand-700',
  slate: 'text-slate-900',
};

/**
 * A headline number. Becomes a link when `to` is given, so the figure itself is
 * the route to acting on it.
 */
export function StatTile({ label, value, hint, tone = 'slate', to }) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', TONE_TEXT[tone])}>
        {value ?? '—'}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const base = 'rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200';

  return to ? (
    <Link to={to} className={cx(base, 'block transition-colors hover:bg-slate-50')}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/** Row of tiles: two columns on a phone, four on a large screen. */
export function StatGrid({ children }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** A prominent call to action, e.g. "Take today's register". */
export function ActionCard({ to, title, description, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-600 hover:bg-brand-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    slate: 'bg-white hover:bg-slate-50 text-slate-900 ring-1 ring-slate-200',
  };

  return (
    <Link
      to={to}
      className={cx('block rounded-xl px-4 py-3 shadow-sm transition-colors', tones[tone])}
    >
      <p className="text-sm font-semibold">{title} →</p>
      {description && (
        <p className={cx('mt-0.5 text-xs', tone === 'slate' ? 'text-slate-500' : 'opacity-90')}>
          {description}
        </p>
      )}
    </Link>
  );
}

/** A card with a "see all" link in its header. */
export function ListCard({ title, subtitle, viewAllTo, viewAllLabel = 'See all', children }) {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        viewAllTo && (
          <Link to={viewAllTo} className="whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
            {viewAllLabel}
          </Link>
        )
      }
    >
      {children}
    </Card>
  );
}

/** Compact empty state for inside a dashboard card. */
export function Nothing({ children }) {
  return <p className="py-3 text-sm text-slate-500">{children}</p>;
}

/** "in 3 days" / "2 days ago" */
export function relativeDue(dueDate) {
  const diffMs = new Date(dueDate).getTime() - Date.now();
  const overdue = diffMs < 0;
  const minutes = Math.abs(diffMs) / 60000;

  let text;
  if (minutes < 60) text = `${Math.round(minutes)} min`;
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} hr`;
  else {
    const days = Math.round(minutes / (60 * 24));
    text = `${days} day${days === 1 ? '' : 's'}`;
  }

  return { overdue, text: overdue ? `${text} overdue` : `in ${text}` };
}

export function shortDateTime(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Attendance percentage against the college threshold. */
export function attendanceTone(percentage, threshold) {
  if (percentage === null || percentage === undefined) return 'slate';
  if (percentage < threshold) return 'rose';
  if (percentage < threshold + 10) return 'amber';
  return 'green';
}

/** Notice list item, reused by all three dashboards. */
export function NoticeRow({ notice }) {
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium text-slate-900">{notice.title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{notice.body}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {notice.postedBy.name} · {relativeTime(notice.createdAt)}
        {notice.targetType === 'ALL' && (
          <Badge tone="rose" className="ml-2">
            College-wide
          </Badge>
        )}
      </p>
    </li>
  );
}
