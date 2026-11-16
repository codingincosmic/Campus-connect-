/**
 * Student dashboard.
 *
 * Answers, in order: am I marked present today, what's due, what's new, how am
 * I doing. Marks themselves are not shown here — those live on the marksheet.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
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
import { Alert, Badge, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsyncData(() => api.get('/dashboard/student'), []);

  const firstName = user.name.split(' ')[0];

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={`Hello, ${firstName}`} />
        <Alert tone="error">{readLoadError(error)}</Alert>
      </>
    );
  }

  const { classes, todayAttendance, attendance, assignments, notices, performance, threshold } = data;

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={`Hello, ${firstName}`} />
        <Card>
          <EmptyState title="You are not enrolled in a class yet">
            Contact the college office if you think this is a mistake.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle={user.rollNo ? `Roll number ${user.rollNo}` : undefined}
        action={<Badge tone="brand">Student</Badge>}
      />

      {/* Most urgent thing first. */}
      {attendance.isDefaulter && (
        <Alert tone="error" title="Your attendance is below the required minimum" className="mb-4">
          You are at {attendance.percentage}% and the college requires {threshold}%.{' '}
          <Link to="/student/attendance" className="font-medium underline">
            See the breakdown
          </Link>
          .
        </Alert>
      )}
      {assignments.counts.OVERDUE > 0 && (
        <Alert tone="warning" title="Overdue work" className="mb-4">
          {assignments.counts.OVERDUE} assignment
          {assignments.counts.OVERDUE === 1 ? '' : 's'} past the due date.{' '}
          <Link to="/student/assignments" className="font-medium underline">
            Submit now
          </Link>
          .
        </Alert>
      )}

      <div className="mb-4">
        <StatGrid>
          <StatTile
            label="Attendance"
            value={attendance.percentage === null ? '—' : `${attendance.percentage}%`}
            hint={`${attendance.attended} of ${attendance.counted} classes`}
            tone={attendanceTone(attendance.percentage, threshold)}
            to="/student/attendance"
          />
          <StatTile
            label="Due soon"
            value={assignments.upcoming.length}
            hint="next 7 days"
            tone={assignments.upcoming.length > 0 ? 'brand' : 'green'}
            to="/student/assignments"
          />
          <StatTile
            label="Overdue"
            value={assignments.counts.OVERDUE}
            tone={assignments.counts.OVERDUE > 0 ? 'rose' : 'green'}
            to="/student/assignments"
          />
          <StatTile
            label={performance ? `CGPA (of ${performance.gpaScale})` : 'CGPA'}
            value={performance?.cgpa ?? '—'}
            hint={
              performance?.percentage !== null && performance?.percentage !== undefined
                ? `${performance.percentage}% overall`
                : 'no results yet'
            }
            tone={performance?.cgpa ? 'green' : 'slate'}
            to="/student/results"
          />
        </StatGrid>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Today --- */}
        <ListCard
          title="Today's attendance"
          subtitle={formatToday(data.today)}
          viewAllTo="/student/attendance"
        >
          {todayAttendance.length === 0 ? (
            <Nothing>Nothing marked for today yet.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayAttendance.map((r, i) => (
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

        {/* --- Deadlines --- */}
        <ListCard title="Coming up" subtitle="Not yet submitted" viewAllTo="/student/assignments">
          {assignments.upcoming.length === 0 && assignments.overdue.length === 0 ? (
            <Nothing>Nothing due — you are up to date.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...assignments.overdue, ...assignments.upcoming].map((a) => {
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

        {/* --- Notices --- */}
        <ListCard title="Latest notices" viewAllTo="/student/notices">
          {notices.length === 0 ? (
            <Nothing>No notices yet.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notices.map((n) => (
                <NoticeRow key={n.id} notice={n} />
              ))}
            </ul>
          )}
        </ListCard>

        {/* --- Performance --- */}
        <ListCard title="Performance snapshot" viewAllTo="/student/results" viewAllLabel="Full marksheet">
          {!performance || performance.subjectsGraded === 0 ? (
            <Nothing>No results published yet.</Nothing>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Figure label="CGPA" value={performance.cgpa ?? '—'} />
                <Figure
                  label="Overall"
                  value={performance.percentage === null ? '—' : `${performance.percentage}%`}
                />
                <Figure
                  label="Credits earned"
                  value={`${performance.creditsEarned}/${performance.creditsAttempted}`}
                />
                <Figure
                  label="Subjects graded"
                  value={performance.subjectsGraded}
                  tone={performance.subjectsFailed > 0 ? 'text-rose-700' : undefined}
                  hint={performance.subjectsFailed > 0 ? `${performance.subjectsFailed} failed` : undefined}
                />
              </div>

              {performance.recent.length > 1 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Recent assessments
                  </p>
                  <div className="flex items-end gap-1.5">
                    {performance.recent.map((r, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] tabular-nums text-slate-500">
                          {r.percentage}%
                        </span>
                        <div className="flex h-14 w-full items-end rounded bg-slate-100">
                          <div
                            className="w-full rounded bg-brand-500"
                            style={{ height: `${Math.max(4, r.percentage)}%` }}
                            title={`${r.title}: ${r.marksObtained}/${r.maxMarks}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ListCard>
      </div>
    </>
  );
}

function Figure({ label, value, hint, tone }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</p>
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
