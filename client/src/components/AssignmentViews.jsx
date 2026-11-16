/**
 * Shared pieces for the assignment screens (student, parent and teacher).
 */
import { Badge, Card, EmptyState, cx } from './ui.jsx';

/**
 * Status labels.
 *
 * Students and parents see "Evaluated" rather than "Graded", because no grade
 * is shown on this screen — the marks go to the marksheet. Teachers use
 * STAFF_STATUS_META below, where "Graded" is accurate.
 */
export const STATUS_META = {
  PENDING: { label: 'Pending', tone: 'brand' },
  SUBMITTED: { label: 'Submitted', tone: 'amber' },
  GRADED: { label: 'Evaluated', tone: 'green' },
  OVERDUE: { label: 'Overdue', tone: 'rose' },
};

export const STAFF_STATUS_META = {
  ...STATUS_META,
  GRADED: { label: 'Graded', tone: 'green' },
};

/** "15 Aug 2026, 23:59" */
export function formatDateTime(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Human-friendly time remaining, e.g. "due in 3 days" / "2 days overdue".
 * Students care about this far more than the raw timestamp.
 */
export function dueLabel(dueDate) {
  const diffMs = new Date(dueDate).getTime() - Date.now();
  const overdue = diffMs < 0;
  const minutes = Math.abs(diffMs) / 60000;

  let text;
  if (minutes < 60) text = `${Math.round(minutes)} min`;
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} hr`;
  else text = `${Math.round(minutes / (60 * 24))} day${Math.round(minutes / (60 * 24)) === 1 ? '' : 's'}`;

  return { overdue, text: overdue ? `${text} overdue` : `due in ${text}` };
}

/** A download link styled as a button-ish chip. */
export function FileLink({ url, name, label = 'Download' }) {
  if (!url) return null;
  return (
    <a
      href={url}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
      title={name}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="max-w-[10rem] truncate">{name || label}</span>
    </a>
  );
}

/** Status filter tabs with counts, shared by student and parent views. */
export function StatusTabs({ counts, value, onChange }) {
  const tabs = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'GRADED', label: 'Evaluated' },
    { key: 'OVERDUE', label: 'Overdue' },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter assignments">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cx(
            'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.key
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {tab.label}
          <span className={cx('ml-1.5 text-xs', value === tab.key ? 'text-brand-100' : 'text-slate-400')}>
            {counts[tab.key] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * One assignment as a card. `action` is the submit button on the student page
 * and nothing on the parent page, which is read-only.
 */
export function AssignmentCard({ assignment, action }) {
  const status = STATUS_META[assignment.status] ?? STATUS_META.PENDING;
  const due = dueLabel(assignment.dueDate);
  const submission = assignment.submission;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{assignment.title}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
            {submission?.isLate && <Badge tone="rose">Late</Badge>}
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {assignment.subject.name} · {assignment.subject.class.name}{' '}
            {assignment.subject.class.section} · {assignment.maxMarks} marks
          </p>

          {assignment.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{assignment.description}</p>
          )}

          <p className={cx('mt-2 text-xs', due.overdue ? 'font-medium text-rose-600' : 'text-slate-500')}>
            Due {formatDateTime(assignment.dueDate)} — {due.text}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {assignment.hasFile && (
              <FileLink url={assignment.fileDownloadUrl} name={assignment.fileName} />
            )}
            {submission?.hasFile && (
              <FileLink url={submission.fileDownloadUrl} name={submission.fileName} />
            )}
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/*
        Evaluated work. Marks are NOT shown here on purpose: they are an
        official record and belong on the marksheet, so this only confirms the
        work has been assessed and points the reader to where the marks live.
      */}
      {submission?.isEvaluated && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">Evaluated</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Your marks for this assignment are recorded on the marksheet.
          </p>
          {submission.feedback && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              <span className="font-medium text-slate-700">Teacher&apos;s feedback: </span>
              {submission.feedback}
            </p>
          )}
        </div>
      )}

      {/* Submitted but not yet assessed */}
      {submission && !submission.isEvaluated && (
        <p className="mt-3 text-xs text-slate-500">
          Submitted {formatDateTime(submission.submittedAt)} — waiting to be evaluated.
        </p>
      )}
    </Card>
  );
}

export function AssignmentList({ items, renderAction, emptyTitle = 'Nothing here' }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyTitle} />
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((assignment) => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          action={renderAction?.(assignment)}
        />
      ))}
    </div>
  );
}
