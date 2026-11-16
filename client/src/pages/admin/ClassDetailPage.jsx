/**
 * Admin → Classes → one class
 *
 * Two things are managed here:
 *   1. Subjects  — name, code, credits, assigned teacher
 *   2. Students  — the class roster (enroll / remove)
 */
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal, ConfirmDialog } from '../../components/Modal.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pagination,
  Select,
  TableWrap,
  Td,
  Th,
  TruncationNotice,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const klassQuery = useAsyncData(() => api.get(`/classes/${id}`), [id]);
  const teachersQuery = useAsyncData(
    () => api.get('/users?role=TEACHER&pageSize=100&isActive=true'),
    []
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const klass = klassQuery.data;
  const teachers = teachersQuery.data?.items ?? [];

  if (klassQuery.loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (klassQuery.error) {
    return (
      <>
        <PageHeader title="Class" />
        <Alert tone="error">{readLoadError(klassQuery.error)}</Alert>
        <Link to="/admin/classes" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← Back to classes
        </Link>
      </>
    );
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/classes/${id}`);
      navigate('/admin/classes', { replace: true });
    } catch (err) {
      setDeleteError(readFormError(err).formError || err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Link to="/admin/classes" className="mb-2 inline-block text-sm text-brand-600 hover:underline">
        ← All classes
      </Link>

      <PageHeader
        title={`${klass.name} — Section ${klass.section}`}
        subtitle={`${klass.academicYear} · Semester ${klass.semester}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">{klass._count.subjects} subjects</Badge>
            <Badge tone="slate">{klass._count.enrollments} students</Badge>
            <Button variant="danger" className="min-h-9 px-3 py-1.5" onClick={() => setDeleteOpen(true)}>
              Delete class
            </Button>
          </div>
        }
      />

      <div className="grid gap-4">
        <SubjectsCard
          klass={klass}
          teachers={teachers}
          onChanged={klassQuery.reload}
        />
        <RosterCard classId={id} onChanged={klassQuery.reload} />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        loading={deleting}
        error={deleteError}
        title="Delete this class?"
        message={`This permanently removes ${klass.name} — Section ${klass.section}. It only works once the class has no subjects and no enrolled students.`}
        confirmLabel="Delete class"
      />
    </>
  );
}

/* ========================================================================== */
/* Subjects                                                                   */
/* ========================================================================== */

function SubjectsCard({ klass, teachers, onChanged }) {
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/subjects/${confirmDelete.id}`);
      setConfirmDelete(null);
      onChanged();
    } catch (err) {
      setDeleteError(readFormError(err).formError || err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card
      title="Subjects"
      subtitle="Credits are used to weight the SGPA and CGPA calculation"
      action={
        <Button className="min-h-9 px-3 py-1.5" onClick={() => setEditing({})}>
          Add subject
        </Button>
      }
    >
      {klass.subjects.length === 0 ? (
        <EmptyState title="No subjects yet">
          Add the subjects taught in this class, then assign a teacher to each one.
        </EmptyState>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <Th>Subject</Th>
                <Th>Code</Th>
                <Th className="text-right">Credits</Th>
                <Th>Teacher</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {klass.subjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{subject.name}</Td>
                  <Td className="text-slate-500">{subject.code || '—'}</Td>
                  <Td className="text-right tabular-nums">{subject.credits}</Td>
                  <Td>
                    {subject.teacher ? (
                      subject.teacher.name
                    ) : (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(subject)}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(subject)}
                      className="ml-3 text-sm font-medium text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <SubjectModal
        open={editing !== null}
        subject={editing?.id ? editing : null}
        classId={klass.id}
        teachers={teachers}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
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
        title="Delete this subject?"
        message={`"${confirmDelete?.name}" will be removed. This is refused if the subject already has attendance records or assignments.`}
        confirmLabel="Delete subject"
      />
    </Card>
  );
}

function SubjectModal({ open, subject, classId, teachers, onClose, onSaved }) {
  const isEdit = Boolean(subject);
  const blank = { name: '', code: '', credits: '3', teacherId: '' };

  const [form, setForm] = useState(blank);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** Tracks which subject the form was last loaded from, so switching rows refills it. */
  const [loadedFor, setLoadedFor] = useState(null);

  // Fill the form when the modal opens for a different subject.
  const key = subject?.id ?? (open ? 'new' : null);
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setForm(
      subject
        ? {
            name: subject.name,
            code: subject.code ?? '',
            credits: String(subject.credits),
            teacherId: subject.teacherId ?? '',
          }
        : blank
    );
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

    // An empty teacher selection means "unassigned", which the API expects as null.
    const payload = {
      name: form.name,
      code: form.code,
      credits: form.credits,
      teacherId: form.teacherId || null,
    };

    try {
      if (isEdit) await api.patch(`/subjects/${subject.id}`, payload);
      else await api.post('/subjects', { ...payload, classId });
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
      title={isEdit ? 'Edit subject' : 'Add subject'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="subject-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Add subject'}
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="Subject name"
          name="name"
          placeholder="e.g. Data Structures"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Subject code"
            name="code"
            placeholder="e.g. BCA301"
            hint="Optional"
            value={form.code}
            onChange={update('code')}
            error={fieldErrors.code}
          />
          <Field
            label="Credits"
            name="credits"
            type="number"
            min="1"
            max="12"
            hint="Weights the GPA"
            value={form.credits}
            onChange={update('credits')}
            error={fieldErrors.credits}
            required
          />
        </div>

        <Select
          label="Teacher"
          name="teacherId"
          placeholder="— Unassigned —"
          value={form.teacherId}
          onChange={update('teacherId')}
          error={fieldErrors.teacherId}
          hint="The teacher who marks attendance and grades work for this subject"
          options={teachers.map((t) => ({ value: t.id, label: t.name }))}
        />
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* Roster                                                                     */
/* ========================================================================== */

function RosterCard({ classId, onChanged }) {
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const { data, loading, error, reload } = useAsyncData(
    () => api.get(`/classes/${classId}/students?page=${page}&pageSize=25`),
    [classId, page]
  );

  const students = data?.items ?? [];

  async function handleRemove() {
    setRemoving(true);
    setRemoveError('');
    try {
      await api.delete(`/classes/${classId}/students/${confirmRemove.id}`);
      setConfirmRemove(null);
      reload();
      onChanged();
    } catch (err) {
      setRemoveError(readFormError(err).formError || err.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card
      title="Students"
      subtitle="Who is enrolled in this class"
      action={
        <Button className="min-h-9 px-3 py-1.5" onClick={() => setAddOpen(true)}>
          Add students
        </Button>
      }
    >
      {error && (
        <Alert tone="error" className="mb-3">
          {readLoadError(error)}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState title="No students enrolled">
          Add existing student accounts to this class, or create new ones from the Students &amp;
          parents page.
        </EmptyState>
      ) : (
        <>
          <TableWrap>
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Roll no.</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                      {student.rollNo || '—'}
                    </Td>
                    <Td>
                      {student.name}
                      {!student.isActive && (
                        <Badge tone="rose" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-slate-500">{student.email}</Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(student)}
                        className="text-sm font-medium text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <AddStudentsModal
        open={addOpen}
        classId={classId}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          reload();
          onChanged();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        onClose={() => {
          setConfirmRemove(null);
          setRemoveError('');
        }}
        onConfirm={handleRemove}
        loading={removing}
        error={removeError}
        title="Remove from this class?"
        message={`${confirmRemove?.name} will no longer be enrolled. Their account and past records are kept.`}
        confirmLabel="Remove"
      />
    </Card>
  );
}

/**
 * Picker listing students who are NOT already in this class.
 * The `notInClassId` filter does that work on the server, so the admin never
 * sees someone they can't actually add.
 */
function AddStudentsModal({ open, classId, onClose, onAdded }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Wait for a pause in typing before hitting the server.
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, loading, error } = useAsyncData(
    () =>
      open
        ? api.get(
            `/users?role=STUDENT&notInClassId=${classId}&pageSize=100&isActive=true` +
              (debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : '')
          )
        : Promise.resolve(null),
    [open, classId, debouncedSearch]
  );

  const students = data?.items ?? [];

  function toggle(studentId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function close() {
    setSelected(new Set());
    setSearch('');
    setFormError('');
    onClose();
  }

  async function handleAdd() {
    setSubmitting(true);
    setFormError('');
    try {
      await api.post(`/classes/${classId}/students`, { studentIds: [...selected] });
      setSelected(new Set());
      setSearch('');
      onAdded();
    } catch (err) {
      setFormError(readFormError(err).formError || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add students to this class"
      description="Only students who are not already enrolled are listed"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={submitting} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} student${selected.size === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {formError && <Alert tone="error">{formError}</Alert>}
        {error && <Alert tone="error">{readLoadError(error)}</Alert>}

        <Field
          label="Search students"
          name="student-search"
          type="search"
          placeholder="Name, roll number or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState title="No students available">
            Every student account is already enrolled here, or none match your search.
          </EmptyState>
        ) : (
          <>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200">
            {students.map((student) => (
              <li key={student.id}>
                {/* The whole row is a label, so tapping anywhere toggles it. */}
                <label className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={selected.has(student.id)}
                    onChange={() => toggle(student.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {student.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {student.rollNo ? `${student.rollNo} · ` : ''}
                      {student.email}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {/* With a large roll, the picker only holds the first page. Say so. */}
          <TruncationNotice shown={students.length} total={data?.total ?? 0} noun="students" />
          </>
        )}
      </div>
    </Modal>
  );
}
