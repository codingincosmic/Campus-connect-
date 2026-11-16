/**
 * Teacher → Assignments
 *
 * Lists assignments for the teacher's subjects with submission progress, and
 * handles create/edit (including the optional attachment).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api, toFormData } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal, ConfirmDialog } from '../../components/Modal.jsx';
import { FileLink, dueLabel, formatDateTime } from '../../components/AssignmentViews.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  Textarea,
  cx,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function TeacherAssignmentsPage() {
  const { context } = useAuth();
  const subjects = context.subjects ?? [];

  const [subjectFilter, setSubjectFilter] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data, loading, error, reload } = useAsyncData(
    () => api.get(`/assignments${subjectFilter ? `?subjectId=${subjectFilter}` : ''}`),
    [subjectFilter]
  );

  const items = data?.items ?? [];

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/assignments/${confirmDelete.id}`);
      setConfirmDelete(null);
      reload();
    } catch (err) {
      setDeleteError(readFormError(err).formError || err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader title="Assignments" />
        <Card>
          <EmptyState title="You have no subjects assigned">
            An administrator needs to assign you to a subject first.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Set work, then grade what comes back"
        action={<Button onClick={() => setEditing({})}>New assignment</Button>}
      />

      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}

      <Card className="mb-4">
        <Select
          label="Subject"
          name="subjectFilter"
          placeholder="All my subjects"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          options={subjects.map((s) => ({
            value: s.id,
            label: `${s.name} — ${s.class.name} ${s.class.section}`,
          }))}
        />
      </Card>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No assignments yet">
            Create one to set work for your class.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((assignment) => {
            const due = dueLabel(assignment.dueDate);
            const submitted = assignment.submissionCount;
            const size = assignment.classSize || 0;
            const pct = size > 0 ? Math.round((submitted / size) * 100) : 0;

            return (
              <Card key={assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{assignment.title}</h3>
                      {assignment.publishedCount > 0 && <Badge tone="green">Results published</Badge>}
                      {assignment.lateCount > 0 && (
                        <Badge tone="amber">{assignment.lateCount} late</Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {assignment.subject.name} · {assignment.subject.class.name}{' '}
                      {assignment.subject.class.section} · {assignment.maxMarks} marks
                    </p>

                    <p
                      className={cx(
                        'mt-1.5 text-xs',
                        due.overdue ? 'text-slate-500' : 'font-medium text-brand-700'
                      )}
                    >
                      Due {formatDateTime(assignment.dueDate)} — {due.text}
                    </p>

                    {/* Submission progress */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 w-32 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-brand-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-slate-500">
                        {submitted}/{size} submitted · {assignment.gradedCount} graded
                      </span>
                    </div>

                    {assignment.hasFile && (
                      <div className="mt-2">
                        <FileLink url={assignment.fileDownloadUrl} name={assignment.fileName} />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Link
                      to={`/teacher/assignments/${assignment.id}`}
                      className="inline-flex min-h-9 items-center rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Grade
                    </Link>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(assignment)}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(assignment)}
                        className="text-sm font-medium text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AssignmentModal
        open={editing !== null}
        assignment={editing?.id ? editing : null}
        subjects={subjects}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => {
          setConfirmDelete(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        loading={deleting}
        error={deleteError}
        title="Delete this assignment?"
        message={`"${confirmDelete?.title}" will be removed. This is refused if students have already submitted work.`}
        confirmLabel="Delete assignment"
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** `datetime-local` needs "YYYY-MM-DDTHH:mm" in LOCAL time, not ISO/UTC. */
function toDateTimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function AssignmentModal({ open, assignment, subjects, onClose, onSaved }) {
  const isEdit = Boolean(assignment);
  const blank = {
    subjectId: subjects[0]?.id ?? '',
    title: '',
    description: '',
    dueDate: toDateTimeLocal(),
    maxMarks: '100',
  };

  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  // Refill the form when the modal opens for a different assignment.
  const key = assignment?.id ?? (open ? 'new' : null);
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setForm(
      assignment
        ? {
            subjectId: assignment.subject.id,
            title: assignment.title,
            description: assignment.description ?? '',
            dueDate: toDateTimeLocal(assignment.dueDate),
            maxMarks: String(assignment.maxMarks),
          }
        : blank
    );
    setFile(null);
    setRemoveFile(false);
    setFieldErrors({});
    setFormError('');
  }

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');

    try {
      if (isEdit) {
        const body = toFormData(
          {
            title: form.title,
            description: form.description,
            dueDate: form.dueDate,
            maxMarks: form.maxMarks,
            ...(removeFile ? { removeFile: 'true' } : {}),
          },
          { name: 'file', file }
        );
        await api.patchForm(`/assignments/${assignment.id}`, body);
      } else {
        await api.postForm('/assignments', toFormData(form, { name: 'file', file }));
      }
      onSaved();
    } catch (err) {
      const parsed = readFormError(err);
      setFieldErrors(parsed.fieldErrors);
      setFormError(parsed.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit assignment' : 'New assignment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create assignment'}
          </Button>
        </>
      }
    >
      <form id="assignment-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        {!isEdit && (
          <Select
            label="Subject"
            name="subjectId"
            value={form.subjectId}
            onChange={update('subjectId')}
            error={fieldErrors.subjectId}
            options={subjects.map((s) => ({
              value: s.id,
              label: `${s.name} — ${s.class.name} ${s.class.section}`,
            }))}
          />
        )}

        <Field
          label="Title"
          name="title"
          placeholder="e.g. Linked List Implementation"
          value={form.title}
          onChange={update('title')}
          error={fieldErrors.title}
          required
        />

        <Textarea
          label="Description"
          name="description"
          rows={4}
          hint="Optional — what students need to do"
          value={form.description}
          onChange={update('description')}
          error={fieldErrors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Due date and time"
            name="dueDate"
            type="datetime-local"
            value={form.dueDate}
            onChange={update('dueDate')}
            error={fieldErrors.dueDate}
            required
          />
          <Field
            label="Maximum marks"
            name="maxMarks"
            type="number"
            min="1"
            max="1000"
            value={form.maxMarks}
            onChange={update('maxMarks')}
            error={fieldErrors.maxMarks}
            required
          />
        </div>

        <div>
          <label htmlFor="file" className="text-sm font-medium text-slate-700">
            Attachment
          </label>
          <input
            id="file"
            name="file"
            type="file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRemoveFile(false);
            }}
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Optional — a question paper or brief for students to download.
          </p>

          {isEdit && assignment.hasFile && !file && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={removeFile}
                onChange={(e) => setRemoveFile(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Remove the current attachment ({assignment.fileName})
            </label>
          )}
        </div>
      </form>
    </Modal>
  );
}
