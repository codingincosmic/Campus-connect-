/**
 * ---------------------------------------------------------------------------
 * SHARED ATTENDANCE DISPLAY COMPONENTS
 * ---------------------------------------------------------------------------
 *
 * The student view and the parent view show the same information about a
 * student, so the presentation lives here once and both pages import it.
 */
import { Badge, Card, EmptyState, TableWrap, Td, Th, cx } from './ui.jsx';

/** Status colours, matching STATUS_META on the server. */
export const STATUS_TONE = {
  PRESENT: 'green',
  ABSENT: 'rose',
  LATE: 'amber',
  EXCUSED: 'slate',
};

export const STATUS_LABEL = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
};

/**
 * Colour-code a percentage against the college threshold.
 * Amber is a deliberate "warning band" just above the line, so a student sees
 * trouble coming before they actually fall below it.
 */
export function percentTone(percentage, threshold) {
  if (percentage === null || percentage === undefined) return 'slate';
  if (percentage < threshold) return 'rose';
  if (percentage < threshold + 10) return 'amber';
  return 'green';
}

const TONE_TEXT = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  slate: 'text-slate-500',
};

const TONE_BAR = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-300',
};

/** Formats a percentage, or an em dash when there's nothing to show yet. */
export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

/* -------------------------------------------------------------------------- */
/* Headline figure                                                            */
/* -------------------------------------------------------------------------- */

export function OverallAttendance({ overall, threshold }) {
  const tone = percentTone(overall.percentage, threshold);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <p className={cx('text-4xl font-semibold tabular-nums', TONE_TEXT[tone])}>
          {formatPercent(overall.percentage)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {overall.attended} of {overall.counted} classes attended
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <ProgressBar value={overall.percentage} threshold={threshold} tone={tone} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(overall.breakdown).map(([status, count]) =>
            count > 0 ? (
              <Badge key={status} tone={STATUS_TONE[status]}>
                {STATUS_LABEL[status]}: {count}
              </Badge>
            ) : null
          )}
        </div>
      </div>

      {overall.isDefaulter && (
        <Badge tone="rose" className="px-3 py-1 text-sm">
          Below {threshold}% — defaulter
        </Badge>
      )}
    </div>
  );
}

/** A bar with a marker showing where the threshold sits. */
export function ProgressBar({ value, threshold, tone }) {
  const width = value === null || value === undefined ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-200">
      <div
        className={cx('h-2.5 rounded-full transition-all', TONE_BAR[tone])}
        style={{ width: `${width}%` }}
      />
      {/* Threshold marker */}
      {threshold !== undefined && (
        <div
          className="absolute top-0 h-2.5 w-0.5 bg-slate-600"
          style={{ left: `${threshold}%` }}
          title={`Threshold ${threshold}%`}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per subject                                                                */
/* -------------------------------------------------------------------------- */

export function SubjectBreakdown({ bySubject, threshold }) {
  if (bySubject.length === 0) {
    return <EmptyState title="No attendance recorded yet" />;
  }

  return (
    <ul className="space-y-4">
      {bySubject.map((subject) => {
        const tone = percentTone(subject.percentage, threshold);
        return (
          <li key={subject.subjectId}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{subject.name}</p>
                <p className="text-xs text-slate-500">
                  {subject.attended} of {subject.counted} attended
                  {subject.breakdown.EXCUSED > 0 && ` · ${subject.breakdown.EXCUSED} excused`}
                </p>
              </div>
              <p className={cx('text-sm font-semibold tabular-nums', TONE_TEXT[tone])}>
                {formatPercent(subject.percentage)}
              </p>
            </div>
            <ProgressBar value={subject.percentage} threshold={threshold} tone={tone} />
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Monthly trend                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A simple CSS bar chart of monthly percentages — no charting library needed
 * for something this small, which keeps the bundle light.
 */
export function MonthlyTrend({ byMonth, threshold }) {
  if (byMonth.length === 0) return <EmptyState title="Not enough data yet" />;

  return (
    <div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: '9rem' }}>
        {byMonth.map((month) => {
          const tone = percentTone(month.percentage, threshold);
          const height = month.percentage === null ? 2 : Math.max(2, month.percentage);
          return (
            <div key={month.month} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span className={cx('text-xs font-medium tabular-nums', TONE_TEXT[tone])}>
                {formatPercent(month.percentage)}
              </span>
              <div className="flex h-24 w-full items-end rounded bg-slate-100">
                <div
                  className={cx('w-full rounded transition-all', TONE_BAR[tone])}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{formatMonth(month.month)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Each bar is one month. The college threshold is {threshold}%.
      </p>
    </div>
  );
}

/** "2026-08" -> "Aug 26" */
function formatMonth(key) {
  const [year, month] = key.split('-');
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString('en', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${name} ${year.slice(2)}`;
}

/* -------------------------------------------------------------------------- */
/* Day-by-day list                                                            */
/* -------------------------------------------------------------------------- */

export function AttendanceRecords({ records, limit = 30 }) {
  if (records.length === 0) return <EmptyState title="No attendance records yet" />;

  const shown = records.slice(0, limit);

  return (
    <>
      <TableWrap>
        <table className="w-full min-w-[28rem] border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Date</Th>
              <Th>Subject</Th>
              <Th>Period</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((record) => (
              <tr key={record.id}>
                <Td className="whitespace-nowrap tabular-nums">{formatDate(record.date)}</Td>
                <Td>{record.subjectName}</Td>
                <Td className="tabular-nums text-slate-500">{record.periodNo}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[record.status]}>{STATUS_LABEL[record.status]}</Badge>
                  {record.edited && (
                    <span
                      className="ml-2 text-xs text-slate-400"
                      title={record.editReason ?? 'Edited by a teacher'}
                    >
                      edited
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {records.length > limit && (
        <p className="mt-2 text-xs text-slate-500">
          Showing the {limit} most recent of {records.length} records.
        </p>
      )}
    </>
  );
}

/** "2026-08-15" -> "15 Aug 2026" */
export function formatDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/* -------------------------------------------------------------------------- */
/* Whole-student panel, used by both the student and parent pages             */
/* -------------------------------------------------------------------------- */

export function AttendanceDetail({ data }) {
  const { overall, bySubject, byMonth, records, threshold } = data;

  return (
    <div className="grid gap-4">
      <Card title="Overall attendance" subtitle={`College threshold is ${threshold}%`}>
        <OverallAttendance overall={overall} threshold={threshold} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By subject">
          <SubjectBreakdown bySubject={bySubject} threshold={threshold} />
        </Card>

        <Card title="Month by month">
          <MonthlyTrend byMonth={byMonth} threshold={threshold} />
        </Card>
      </div>

      <Card title="Day by day" subtitle="Most recent first">
        <AttendanceRecords records={records} />
      </Card>
    </div>
  );
}
