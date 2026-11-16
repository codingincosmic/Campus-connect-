/**
 * Student → My results
 *
 * The official marksheet: subject-wise marks, grades, SGPA per semester and
 * CGPA overall. This is the ONLY place a student sees assignment marks — the
 * assignments page just says "Evaluated".
 */
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { MarksheetView } from '../../components/MarksheetView.jsx';
import { Alert } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function StudentResultsPage() {
  const { data, loading, error } = useAsyncData(() => api.get('/results/me'), []);

  return (
    <>
      <PageHeader
        title="My results"
        subtitle="Marks, grades and your SGPA / CGPA"
      />

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
