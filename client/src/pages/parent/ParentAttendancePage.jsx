/**
 * Parent → Attendance
 *
 * Same presentation as the student page, with a child switcher on top when the
 * parent is linked to more than one student.
 *
 * The server rejects any student id not linked to this parent, so the switcher
 * is a convenience rather than the security boundary.
 */
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { ChildSwitcher, useSelectedChild } from '../../components/ChildSwitcher.jsx';
import { AttendanceDetail } from '../../components/AttendanceViews.jsx';
import { Alert, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ParentAttendancePage() {
  const { children, selected, setSelectedId } = useSelectedChild();

  const { data, loading, error } = useAsyncData(
    () => (selected ? api.get(`/attendance/student/${selected.id}`) : Promise.resolve(null)),
    [selected?.id]
  );

  if (children.length === 0) {
    return (
      <>
        <PageHeader title="Attendance" />
        <Card>
          <EmptyState title="No students are linked to your account">
            Contact the college office so they can link your child to your account.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={selected ? `${selected.name}${selected.rollNo ? ` · ${selected.rollNo}` : ''}` : undefined}
      />

      <ChildSwitcher options={children} selected={selected} onSelect={setSelectedId} />

      {error && <Alert tone="error">{readLoadError(error)}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data ? null : data.overall.total === 0 ? (
        <Card>
          <EmptyState title="No attendance recorded yet">
            {selected.name}&apos;s attendance will appear here once teachers start marking it.
          </EmptyState>
        </Card>
      ) : (
        <>
          {data.overall.isDefaulter && (
            <Alert tone="error" title="Attendance is below the required minimum" className="mb-4">
              {selected.name} is at {data.overall.percentage}%, and the college requires{' '}
              {data.threshold}%.
            </Alert>
          )}
          <AttendanceDetail data={data} />
        </>
      )}
    </>
  );
}
