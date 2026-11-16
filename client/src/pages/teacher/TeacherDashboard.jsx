/**
 * Teacher dashboard.
 *
 * Built around the three things a teacher does every day:
 *   1. take today's registers
 *   2. grade what's been handed in
 *   3. post a notice to their class
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import {
  ActionCard,
  ListCard,
  Nothing,
  StatGrid,
  StatTile,
  relativeDue,
  relativeTime,
  shortDateTime,
} from '../../components/DashboardBits.jsx';
import { Alert, Badge, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsyncData(() => api.get('/dashboard/teacher'), []);

  const firstName = user.name.replace(/^(Prof\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s*/i, '').split(' ')[0];

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
        <PageHeader title={`Welcome, ${firstName}`} />
        <Alert tone="error">{readLoadError(error)}</Alert>
      </>
    );
  }

  const { subjects, toGrade, upcoming, recentNotices, counts, threshold } = data;

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}`} />
        <Card>
          <EmptyState title="You have no subjects assigned">
            An administrator needs to assign you to a subject before you can mark attendance or set
            work.
          </EmptyState>
        </Card>
      </>
    );
  }

  const unmarked = subjects.filter((s) => !s.isMarkedToday);

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle={`Today is ${formatToday(data.today)}`}
        action={<Badge tone="brand">Teacher</Badge>}
      />

      <div className="mb-4">
        <StatGrid>
          <StatTile
            label="Registers due today"
            value={counts.registersDueToday}
            hint={counts.registersDueToday === 0 ? 'All done' : `of ${counts.subjects} subjects`}
            tone={counts.registersDueToday > 0 ? 'amber' : 'green'}
            to="/teacher/attendance"
          />
          <StatTile
            label="Awaiting grading"
            value={counts.awaitingGrading}
            hint="submissions"
            tone={counts.awaitingGrading > 0 ? 'brand' : 'green'}
            to="/teacher/assignments"
          />
          <StatTile
            label="Low attendance"
            value={counts.defaulters}
            hint={`below ${threshold}%`}
            tone={counts.defaulters > 0 ? 'rose' : 'green'}
            to="/teacher/reports"
          />
          <StatTile label="My students" value={counts.students} hint={`${counts.classes} classes`} />
        </StatGrid>
      </div>

      {/* --- Quick actions --- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <ActionCard
          to="/teacher/attendance"
          title="Take a register"
          description={
            counts.registersDueToday > 0
              ? `${counts.registersDueToday} subject(s) not marked today`
              : 'Today is fully marked'
          }
          tone={counts.registersDueToday > 0 ? 'amber' : 'slate'}
        />
        <ActionCard
          to="/teacher/assignments"
          title="Grade submissions"
          description={
            counts.awaitingGrading > 0 ? `${counts.awaitingGrading} waiting` : 'Nothing waiting'
          }
          tone={counts.awaitingGrading > 0 ? 'brand' : 'slate'}
        />
        <ActionCard to="/teacher/notices" title="Post a notice" description="To one of your sections" tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Today's subjects --- */}
        <ListCard
          title="My subjects today"
          subtitle="Tap a subject that still needs its register"
          viewAllTo="/teacher/attendance"
          viewAllLabel="Mark attendance"
        >
          <ul className="divide-y divide-slate-100">
            {subjects.map((subject) => (
              <li key={subject.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{subject.name}</p>
                  <p className="text-xs text-slate-500">
                    {subject.className} · {subject.studentCount} students
                  </p>
                </div>
                {subject.isMarkedToday ? (
                  <Badge tone="green">
                    Marked
                    {subject.markedToday.length > 1 && ` ×${subject.markedToday.length}`}
                  </Badge>
                ) : (
                  <Link
                    to="/teacher/attendance"
                    className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Take register
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {unmarked.length === 0 && (
            <p className="mt-2 text-xs text-emerald-700">Every register is done for today.</p>
          )}
        </ListCard>

        {/* --- To grade --- */}
        <ListCard
          title="Recent submissions to grade"
          subtitle="Oldest first"
          viewAllTo="/teacher/assignments"
        >
          {toGrade.length === 0 ? (
            <Nothing>Nothing waiting to be graded.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {toGrade.map((s) => (
                <li key={s.submissionId} className="py-2.5">
                  <Link
                    to={`/teacher/assignments/${s.assignmentId}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {s.studentName}
                        {s.rollNo && <span className="ml-2 text-xs text-slate-400">{s.rollNo}</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {s.assignmentTitle} · {s.subjectName} {s.className}
                      </p>
                    </div>
                    <div className="text-right">
                      {s.isLate && <Badge tone="rose">Late</Badge>}
                      <span className="block text-xs text-slate-400">
                        {relativeTime(s.submittedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ListCard>

        {/* --- Upcoming deadlines --- */}
        <ListCard title="Upcoming deadlines" subtitle="Next 7 days" viewAllTo="/teacher/assignments">
          {upcoming.length === 0 ? (
            <Nothing>No deadlines in the next week.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => {
                const due = relativeDue(a.dueDate);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">
                        {a.subjectName} {a.className} · {shortDateTime(a.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-medium text-brand-700">{due.text}</span>
                      <span className="block text-xs text-slate-400">
                        {a.submissionCount} submitted
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListCard>

        {/* --- My notices --- */}
        <ListCard title="My recent notices" viewAllTo="/teacher/notices">
          {recentNotices.length === 0 ? (
            <Nothing>You have not posted any notices yet.</Nothing>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentNotices.map((n) => (
                <li key={n.id} className="py-2.5">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-400">{relativeTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      </div>
    </>
  );
}

/** "2026-08-17" -> "Monday, 17 Aug" */
function formatToday(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
