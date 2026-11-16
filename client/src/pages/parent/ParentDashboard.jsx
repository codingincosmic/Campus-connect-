/**
 * Parent dashboard.
 *
 * With one child, it shows that child's full picture. With several, it opens
 * with a comparison row so nothing gets missed, then the selected child's
 * detail below.
 */
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { ChildSwitcher, useSelectedChild } from '../../components/ChildSwitcher.jsx';
import { STATUS_LABEL, STATUS_TONE } from '../../components/AttendanceViews.jsx';
import {
  ListCard,
  Nothing,
  NoticeRow,
  StatGrid,
  StatTile,
  attendanceTone,
  relativeDue,
  shortDateTime,
} from '../../components/DashboardBits.jsx';
import { Alert, Badge, Card, EmptyState, cx } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ParentDashboard() {
  const { user } = useAuth();
  const { children, selected, setSelectedId } = useSelectedChild();

  // Summary row across all children.
  const summary = useAsyncData(() => api.get('/dashboard/parent'), []);
  // Full detail for whichever child is selected.
  const detail = useAsyncData(
    () => (selected ? api.get(`/dashboard/child/${selected.id}`) : Promise.resolve(null)),
    [selected?.id]
  );

  const firstName = user.name.split(' ')[0];

  if (children.length === 0) {
    return (
      <>
        <PageHeader title={`Hello, ${firstName}`} action={<Badge tone="brand">Parent</Badge>} />
        <Card>
          <EmptyState title="No students are linked to your account">
            Contact the college office so they can link your child to your account.
          </EmptyState>
        </Card>
      </>
    );
  }

  const rows = summary.data?.children ?? [];
  const threshold = summary.data?.threshold ?? 75;
  const data = detail.data;

  // Anything a parent should act on, across every child.
  const alerts = rows.filter((c) => c.attendance.isDefaulter || c.assignments.overdue > 0);

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle={
          children.length > 1 ? `You are linked to ${children.length} students` : selected?.name
        }
        action={<Badge tone="brand">Parent</Badge>}
      />

      {/* --- Cross-child alerts, so nothing is hidden behind the switcher --- */}
      {alerts.length > 0 && (
        <Alert tone="warning" title="Needs your attention" className="mb-4">
          <ul className="mt-1 space-y-0.5">
            {alerts.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                {c.attendance.isDefaulter && ` — attendance ${c.attendance.percentage}% (below ${threshold}%)`}
                {c.attendance.isDefaulter && c.assignments.overdue > 0 && ','}
                {c.assignments.overdue > 0 && ` ${c.assignments.overdue} overdue assignment(s)`}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* --- Comparison row when there is more than one child --- */}
      {children.length > 1 && (
        <Card title="My children" className="mb-4" bodyClassName="py-3">
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cx(
                    'min-w-0 flex-1 text-left',
                    selected?.id === c.id && 'font-semibold'
                  )}
                >
                  <span className="block truncate text-sm text-slate-900">{c.name}</span>
                  <span className="block text-xs text-slate-500">
                    {c.rollNo}
                    {c.relationship && ` · ${c.relationship}`}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <Badge tone={attendanceTone(c.attendance.percentage, threshold)}>
                    {c.attendance.percentage === null ? '—' : `${c.attendance.percentage}%`}
                  </Badge>
                  {c.assignments.overdue > 0 && (
                    <Badge tone="rose">{c.assignments.overdue} overdue</Badge>
                  )}
                  {selected?.id === c.id && <Badge tone="brand">Viewing</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ChildSwitcher options={children} selected={selected} onSelect={setSelectedId} />

      {detail.error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(detail.error)}
        </Alert>
      )}

      {detail.loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data ? null : (
        <>
          <div className="mb-4">
            <StatGrid>
              <StatTile
                label="Attendance"
                value={data.attendance.percentage === null ? '—' : `${data.attendance.percentage}%`}
                hint={`${data.attendance.attended} of ${data.attendance.counted} classes`}
                tone={attendanceTone(data.attendance.percentage, data.threshold)}
                to="/parent/attendance"
              />
              <StatTile
                label="Overdue"
                value={data.assignments.counts.OVERDUE}
                tone={data.assignments.counts.OVERDUE > 0 ? 'rose' : 'green'}
                to="/parent/assignments"
              />
              <StatTile
                label="Due soon"
                value={data.assignments.upcoming.length}
                hint="next 7 days"
                to="/parent/assignments"
              />
              <StatTile
                label={data.performance ? `CGPA (of ${data.performance.gpaScale})` : 'CGPA'}
                value={data.performance?.cgpa ?? '—'}
                hint={
                  data.performance?.percentage != null
                    ? `${data.performance.percentage}% overall`
                    : 'no results yet'
                }
                to="/parent/results"
              />
            </StatGrid>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard
              title="Today's attendance"
              subtitle={formatToday(data.today)}
              viewAllTo="/parent/attendance"
            >
              {data.todayAttendance.length === 0 ? (
                <Nothing>Nothing marked for today yet.</Nothing>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.todayAttendance.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                        {r.subjectName}
                        <span className="ml-2 text-xs text-slate-400">Period {r.periodNo}</span>
                      </span>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </ListCard>

            <ListCard
              title="Assignments to watch"
              subtitle="Overdue first"
              viewAllTo="/parent/assignments"
            >
              {data.assignments.overdue.length === 0 && data.assignments.upcoming.length === 0 ? (
                <Nothing>Nothing outstanding.</Nothing>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...data.assignments.overdue, ...data.assignments.upcoming].map((a) => {
                    const due = relativeDue(a.dueDate);
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                          <p className="text-xs text-slate-500">
                            {a.subjectName} · {shortDateTime(a.dueDate)}
                          </p>
                        </div>
                        <Badge tone={due.overdue ? 'rose' : 'brand'}>{due.text}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ListCard>

            <ListCard title="Latest notices" viewAllTo="/parent/notices">
              {data.notices.length === 0 ? (
                <Nothing>No notices yet.</Nothing>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.notices.map((n) => (
                    <NoticeRow key={n.id} notice={n} />
                  ))}
                </ul>
              )}
            </ListCard>

            <ListCard title="Results" viewAllTo="/parent/results" viewAllLabel="Full marksheet">
              {!data.performance || data.performance.subjectsGraded === 0 ? (
                <Nothing>No results published yet.</Nothing>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Figure label="CGPA" value={data.performance.cgpa ?? '—'} />
                  <Figure
                    label="Overall"
                    value={
                      data.performance.percentage === null ? '—' : `${data.performance.percentage}%`
                    }
                  />
                  <Figure
                    label="Credits earned"
                    value={`${data.performance.creditsEarned}/${data.performance.creditsAttempted}`}
                  />
                  <Figure
                    label="Subjects graded"
                    value={data.performance.subjectsGraded}
                    hint={
                      data.performance.subjectsFailed > 0
                        ? `${data.performance.subjectsFailed} failed`
                        : undefined
                    }
                  />
                </div>
              )}
            </ListCard>
          </div>
        </>
      )}
    </>
  );
}

function Figure({ label, value, hint }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="text-xs text-rose-600">{hint}</p>}
    </div>
  );
}

function formatToday(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
