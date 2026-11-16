/**
 * Admin → Teachers & activity
 *
 * Read-only oversight of what teaching staff have been doing: per-teacher
 * activity counts, and a merged audit feed of assignments created, attendance
 * marked, attendance CHANGED (with the reason given) and work graded.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Select,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

/** Colour and label per activity type. */
const EVENT_META = {
  ASSIGNMENT_CREATED: { label: 'Assignment created', tone: 'brand' },
  ATTENDANCE_MARKED: { label: 'Attendance marked', tone: 'slate' },
  ATTENDANCE_EDITED: { label: 'Attendance changed', tone: 'amber' },
  SUBMISSION_GRADED: { label: 'Work graded', tone: 'green' },
};

export function AdminOversightPage() {
  const [teacherId, setTeacherId] = useState('');
  const [type, setType] = useState('ALL');

  const overview = useAsyncData(() => api.get('/admin/overview'), []);
  const teachers = useAsyncData(() => api.get('/admin/teachers'), []);
  const activity = useAsyncData(
    () =>
      api.get(
        `/admin/activity?limit=60${teacherId ? `&teacherId=${teacherId}` : ''}${type !== 'ALL' ? `&type=${type}` : ''}`
      ),
    [teacherId, type]
  );

  const stats = overview.data;
  const teacherRows = teachers.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Teachers & activity"
        subtitle="What teaching staff have recorded across the college"
      />

      {/* --- Headline numbers, including things that need chasing --- */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Teachers" value={stats.teachers} />
          <Stat label="Assignments set" value={stats.assignments} />
          <Stat
            label="Awaiting grading"
            value={stats.ungradedSubmissions}
            tone={stats.ungradedSubmissions > 0 ? 'amber' : 'green'}
          />
          <Stat
            label="Subjects with no teacher"
            value={stats.unassignedSubjects}
            tone={stats.unassignedSubjects > 0 ? 'rose' : 'green'}
          />
        </div>
      )}

      {(overview.error || teachers.error) && (
        <Alert tone="error" className="mb-4">
          {readLoadError(overview.error ?? teachers.error)}
        </Alert>
      )}

      {/* --- Per-teacher table --- */}
      <Card
        title="Teacher activity"
        subtitle="Attendance is counted as sessions (one subject, one date, one period)"
        className="mb-4"
      >
        {teachers.loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : teacherRows.length === 0 ? (
          <EmptyState title="No teacher accounts yet" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Teacher</Th>
                  <Th>Classes</Th>
                  <Th className="text-right">Subjects</Th>
                  <Th className="text-right">Assignments</Th>
                  <Th className="text-right">Attendance</Th>
                  <Th className="text-right">Edits</Th>
                  <Th className="text-right">Graded</Th>
                  <Th>Last active</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherRows.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50">
                    <Td>
                      <span className="font-medium text-slate-900">{teacher.name}</span>
                      <span className="block text-xs text-slate-500">{teacher.email}</span>
                      {!teacher.isActive && (
                        <Badge tone="rose" className="mt-1">
                          Inactive
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-xs text-slate-600">
                      {teacher.classes.length === 0
                        ? '—'
                        : teacher.classes.map((c) => `${c.name} ${c.section}`).join(', ')}
                    </Td>
                    <Td className="text-right tabular-nums">{teacher.stats.subjects}</Td>
                    <Td className="text-right tabular-nums">{teacher.stats.assignmentsCreated}</Td>
                    <Td className="text-right tabular-nums">
                      {teacher.stats.attendanceSessions}
                      <span className="block text-xs text-slate-400">
                        {teacher.stats.attendanceRecords} marks
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {/* Edits are the number worth watching. */}
                      <span className={teacher.stats.attendanceEdits > 0 ? 'text-amber-700' : ''}>
                        {teacher.stats.attendanceEdits}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{teacher.stats.submissionsGraded}</Td>
                    <Td className="whitespace-nowrap text-xs text-slate-500">
                      {teacher.lastActiveAt ? relativeTime(teacher.lastActiveAt) : 'No activity yet'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {/* --- Activity feed --- */}
      <Card
        title="Recent activity"
        subtitle="Newest first"
        action={
          <div className="flex flex-wrap gap-2">
            <Select
              name="teacherFilter"
              placeholder="All teachers"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="min-w-40"
              options={teacherRows.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              name="typeFilter"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="min-w-44"
              options={[
                { value: 'ALL', label: 'All activity' },
                { value: 'ASSIGNMENT_CREATED', label: 'Assignments created' },
                { value: 'ATTENDANCE_MARKED', label: 'Attendance marked' },
                { value: 'ATTENDANCE_EDITED', label: 'Attendance changed' },
                { value: 'SUBMISSION_GRADED', label: 'Work graded' },
              ]}
            />
          </div>
        }
      >
        {activity.error && (
          <Alert tone="error" className="mb-3">
            {readLoadError(activity.error)}
          </Alert>
        )}

        {activity.loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (activity.data?.items ?? []).length === 0 ? (
          <EmptyState title="No activity recorded yet">
            Activity appears here as teachers mark attendance, set assignments and grade work.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.data.items.map((event, index) => {
              const meta = EVENT_META[event.type] ?? { label: event.type, tone: 'slate' };
              return (
                <li
                  key={`${event.type}-${event.at}-${index}`}
                  className={cx('py-3', event.highlight && 'bg-amber-50/60 px-2 -mx-2 rounded-lg')}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-sm font-medium text-slate-900">{event.teacher.name}</span>
                    <span className="text-xs text-slate-400">{relativeTime(event.at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{event.summary}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {event.subject} · {event.className}
                  </p>
                  {event.detail && (
                    <p
                      className={cx(
                        'mt-0.5 text-xs',
                        event.highlight ? 'font-medium text-amber-800' : 'text-slate-500'
                      )}
                    >
                      {event.detail}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Looking for what was set for a particular class?{' '}
        <Link to="/admin/assignments" className="text-brand-600 hover:underline">
          See all assignments
        </Link>
        .
      </p>
    </>
  );
}

const TONE_TEXT = { green: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' };

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cx(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone ? TONE_TEXT[tone] : 'text-slate-900'
        )}
      >
        {value ?? '—'}
      </p>
    </div>
  );
}

/** "3 hours ago" — more useful than a timestamp when scanning a feed. */
function relativeTime(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
