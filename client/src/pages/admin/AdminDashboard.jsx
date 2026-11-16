/**
 * Admin dashboard — Phase 1 version.
 *
 * Right now it confirms the session works and shows what the seed created.
 * Phase 2 replaces the placeholder cards with real management screens.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { Badge, Card, EmptyState } from '../../components/ui.jsx';
import { PageHeader } from '../../components/AppLayout.jsx';

export function AdminDashboard() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);

  // Pull the college-wide config so the grading scheme is visible at a glance.
  useEffect(() => {
    api
      .get('/config')
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  /**
   * Headline counts. `pageSize=1` is deliberate: we only need the `total` from
   * each response, not the rows, so this stays cheap.
   */
  const classes = useAsyncData(() => api.get('/classes'), []);
  const students = useAsyncData(() => api.get('/users?role=STUDENT&pageSize=1'), []);
  const teachers = useAsyncData(() => api.get('/users?role=TEACHER&pageSize=1'), []);
  const parents = useAsyncData(() => api.get('/users?role=PARENT&pageSize=1'), []);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ').slice(-1)[0]}`}
        subtitle="Administrator overview"
        action={<Badge tone="brand">Administrator</Badge>}
      />

      {/* --- Headline counts, each linking to where you manage them --- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Classes" value={classes.data?.items.length} to="/admin/classes" />
        <StatTile label="Students" value={students.data?.total} to="/admin/users" />
        <StatTile label="Teachers" value={teachers.data?.total} to="/admin/users" />
        <StatTile label="Parents" value={parents.data?.total} to="/admin/users" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="College settings" subtitle="Configured in server/.env and src/config">
          {config ? (
            <dl className="space-y-2 text-sm">
              <Row label="Attendance threshold" value={`${config.attendanceThreshold}%`} />
              <Row
                label="Attendance edit window"
                value={`${config.attendanceEditWindowDays} days`}
              />
              <Row label="Max upload size" value={`${config.maxUploadMb} MB`} />
              <Row label="GPA scale" value={`${config.grading.gpaScale}-point`} />
              <Row label="Pass mark" value={`${config.grading.passPercentage}%`} />
            </dl>
          ) : (
            <EmptyState title="Could not load settings" />
          )}
        </Card>

        <Card title="Grading scheme" subtitle="Edit server/src/config/grading.js to change">
          {config ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">From</th>
                    <th className="pb-2 pr-3 font-medium">Grade</th>
                    <th className="pb-2 pr-3 font-medium">Point</th>
                    <th className="pb-2 font-medium">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.grading.bands.map((band) => (
                    <tr key={band.grade}>
                      <td className="py-1.5 pr-3 tabular-nums text-slate-600">{band.min}%</td>
                      <td className="py-1.5 pr-3 font-medium text-slate-900">{band.grade}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-slate-600">{band.point}</td>
                      <td className="py-1.5 text-slate-500">{band.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Could not load grading scheme" />
          )}
        </Card>

        <Card title="Manage" className="sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink
              to="/admin/classes"
              title="Classes & subjects"
              description="Create classes and sections, add subjects with credits, assign teachers, and manage the student roster."
            />
            <QuickLink
              to="/admin/users"
              title="Students & parents"
              description="Create accounts, enroll students, link parents to their children, and reset passwords."
            />
            <QuickLink
              to="/admin/assignments"
              title="All assignments"
              description="Every assignment set across the college, showing exactly which class and section can see each one."
            />
            <QuickLink
              to="/admin/oversight"
              title="Teachers & activity"
              description="Track what each teacher has recorded: attendance sessions, assignments set, work graded, and any attendance changes with their reasons."
            />
          </div>
        </Card>
      </div>
    </>
  );
}

/** A headline number that doubles as a link to where you manage it. */
function StatTile({ label, value, to }) {
  return (
    <Link
      to={to}
      className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {/* An em dash while loading avoids the layout jumping when the number lands. */}
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value ?? '—'}
      </p>
    </Link>
  );
}

function QuickLink({ to, title, description }) {
  return (
    <Link
      to={to}
      className="block rounded-lg p-3 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <p className="text-sm font-semibold text-brand-700">{title} →</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </Link>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
