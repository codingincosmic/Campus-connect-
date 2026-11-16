/**
 * Student → My attendance
 *
 * Reads GET /attendance/me, which the server scopes to the logged-in student,
 * so there is no student id in the URL to tamper with.
 */
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { AttendanceDetail } from '../../components/AttendanceViews.jsx';
import { Alert, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function StudentAttendancePage() {
  const { data, loading, error } = useAsyncData(() => api.get('/attendance/me'), []);

  return (
    <>
      <PageHeader title="My attendance" subtitle="Overall, by subject and month by month" />

      {error && <Alert tone="error">{readLoadError(error)}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data ? null : data.overall.total === 0 ? (
        <Card>
          <EmptyState title="No attendance recorded yet">
            Your attendance will appear here once your teachers start marking it.
          </EmptyState>
        </Card>
      ) : (
        <>
          {data.overall.isDefaulter && (
            <Alert tone="error" title="Your attendance is below the required minimum" className="mb-4">
              You are at {data.overall.percentage}%, and the college requires {data.threshold}%.
              Speak to your class teacher about how to catch up.
            </Alert>
          )}
          <AttendanceDetail data={data} />
        </>
      )}
    </>
  );
}
