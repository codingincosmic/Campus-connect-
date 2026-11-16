/**
 * Parent → Results
 *
 * Their child's marksheet, identical in presentation to the student's own view.
 * The server rejects any student not linked to this parent, so the child
 * switcher is convenience, not the security boundary.
 */
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { ChildSwitcher, useSelectedChild } from '../../components/ChildSwitcher.jsx';
import { MarksheetView } from '../../components/MarksheetView.jsx';
import { Alert, Card, EmptyState } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ParentResultsPage() {
  const { children, selected, setSelectedId } = useSelectedChild();

  const { data, loading, error } = useAsyncData(
    () => (selected ? api.get(`/results/student/${selected.id}`) : Promise.resolve(null)),
    [selected?.id]
  );

  if (children.length === 0) {
    return (
      <>
        <PageHeader title="Results" />
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
        title="Results"
        subtitle={selected ? `${selected.name}${selected.rollNo ? ` · ${selected.rollNo}` : ''}` : undefined}
      />

      <ChildSwitcher options={children} selected={selected} onSelect={setSelectedId} />

      {error && <Alert tone="error">{readLoadError(error)}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        data && <MarksheetView data={data} />
      )}
    </>
  );
}
