/**
 * Student → Assignments
 *
 * Lists everything set for the student's classes, filtered by status, with a
 * file upload for submitting work.
 */
import { useState } from 'react';
import { api, toFormData } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal } from '../../components/Modal.jsx';
import {
  AssignmentList,
  StatusTabs,
  formatDateTime,
  dueLabel,
} from '../../components/AssignmentViews.jsx';
import { Alert, Button, Card } from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function StudentAssignmentsPage() {
  const [status, setStatus] = useState('ALL');
  const [submitFor, setSubmitFor] = useState(null);
  const [flash, setFlash] = useState('');

  const { data, loading, error, reload } = useAsyncData(
    () => api.get(`/assignments/mine?status=${status}`),
    [status]
  );

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader title="My assignments" subtitle="Upload your work before the due date" />

      {flash && (
        <Alert tone="success" className="mb-4">
          {flash}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
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
            counts.ALL === 0 ? 'No assignments yet' : `Nothing with the status "${status.toLowerCase()}"`
          }
          renderAction={(assignment) => (
            <Button
              variant={assignment.submission ? 'secondary' : 'primary'}
              className="min-h-9 px-3 py-1.5"
              onClick={() => setSubmitFor(assignment)}
              // Once a mark is published the work is final.
              disabled={assignment.status === 'GRADED'}
            >
              {assignment.status === 'GRADED'
                ? 'Evaluated'
                : assignment.submission
                  ? 'Replace file'
                  : 'Submit'}
            </Button>
          )}
        />
      )}

      <SubmitModal
        assignment={submitFor}
        onClose={() => setSubmitFor(null)}
        onSubmitted={(result) => {
          setSubmitFor(null);
          setFlash(
            result.isLate
              ? 'Work submitted — it was after the due date, so it is marked late.'
              : 'Work submitted on time.'
          );
          reload();
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function SubmitModal({ assignment, onClose, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!assignment) return null;

  const due = dueLabel(assignment.dueDate);

  function close() {
    setFile(null);
    setFormError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setFormError('Choose a file to upload.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = await api.postForm(
        `/assignments/${assignment.id}/submit`,
        toFormData({}, { name: 'file', file })
      );
      setFile(null);
      onSubmitted(result);
    } catch (err) {
      setFormError(readFormError(err).formError || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={assignment.submission ? 'Replace your submission' : 'Submit your work'}
      description={assignment.title}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="submit-form" loading={submitting} disabled={!file}>
            Upload
          </Button>
        </>
      }
    >
      <form id="submit-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        {due.overdue && (
          <Alert tone="warning" title="This is past the due date">
            Your submission will still be accepted, but it will be marked as late for your teacher.
          </Alert>
        )}

        {assignment.submission && (
          <Alert tone="info">
            You already submitted <strong>{assignment.submission.fileName}</strong>. Uploading a new
            file replaces it.
          </Alert>
        )}

        <div>
          <label htmlFor="file" className="text-sm font-medium text-slate-700">
            Your file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFormError('');
            }}
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
          {file && (
            <p className="mt-1.5 text-xs text-slate-500">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Due {formatDateTime(assignment.dueDate)}. Accepted formats include PDF, Word, images, ZIP
          and common source files.
        </p>
      </form>
    </Modal>
  );
}
