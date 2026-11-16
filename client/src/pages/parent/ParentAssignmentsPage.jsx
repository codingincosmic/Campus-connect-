/**
 * Parent → Assignments
 *
 * Read-only view of a child's assignments: what's pending, what's overdue,
 * what's been submitted and what's been graded. No submit button — parents
 * cannot upload work on a student's behalf.
 */
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { ChildSwitcher, useSelectedChild } from '../../components/ChildSwitcher.jsx';
import { AssignmentList, StatusTabs } from '../../components/AssignmentViews.jsx';
import { Alert, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ParentAssignmentsPage() {
  const { children, selected, setSelectedId } = useSelectedChild();
  const [status, setStatus] = useState('ALL');

  const { data, loading, error } = useAsyncData(
    () =>
      selected
        ? api.get(`/assignments/student/${selected.id}?status=${status}`)
        : Promise.resolve(null),
    [selected?.id, status]
  );

  if (children.length === 0) {
    return (
      <>
        <PageHeader title="Assignments" />
        <Card>
          <EmptyState title="No students are linked to your account">
            Contact the college office so they can link your child to your account.
          </EmptyState>
        </Card>
      </>
    );
  }

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={selected ? `${selected.name}${selected.rollNo ? ` · ${selected.rollNo}` : ''}` : undefined}
      />

      <ChildSwitcher options={children} selected={selected} onSelect={setSelectedId} />

      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}

      {/* Overdue work is the thing a parent most wants flagged. */}
      {counts.OVERDUE > 0 && (
        <Alert tone="warning" title="Overdue work" className="mb-4">
          {selected?.name.split(' ')[0]} has {counts.OVERDUE} assignment
          {counts.OVERDUE === 1 ? '' : 's'} past the due date and not yet submitted.
        </Alert>
      )}

      <StatusTabs counts={counts} value={status} onChange={setStatus} />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <AssignmentList
          items={items}
          emptyTitle={
            counts.ALL === 0
              ? 'No assignments yet'
              : `Nothing with the status "${status.toLowerCase()}"`
          }
        />
      )}
    </>
  );
}
