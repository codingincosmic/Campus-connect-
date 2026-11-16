/**
 * Admin → Classes
 *
 * Lists every class+section and lets the admin create one. Clicking a class
 * opens its detail page, where subjects and the student roster are managed.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal } from '../../components/Modal.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  TableWrap,
  Td,
  Th,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ClassesPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, loading, error, reload } = useAsyncData(() => api.get('/classes'), []);
  const classes = data?.items ?? [];

  // Filtering happens on the client: a college has tens of classes, not
  // thousands, so this stays instant without a round trip per keystroke.
  const term = search.trim().toLowerCase();
  const visible = term
    ? classes.filter((c) =>
        `${c.name} ${c.section} ${c.academicYear}`.toLowerCase().includes(term)
      )
    : classes;

  return (
    <>
      <PageHeader
        title="Classes & sections"
        subtitle="Each row is one class and section for an academic year"
        action={<Button onClick={() => setCreateOpen(true)}>New class</Button>}
      />

      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}

      <Card>
        <div className="mb-3">
          <Field
            label="Search"
            name="search"
            type="search"
            placeholder="Class name, section or year"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title={classes.length === 0 ? 'No classes yet' : 'No matching classes'}>
            {classes.length === 0
              ? 'Create your first class to start adding subjects and students.'
              : 'Try a different search term.'}
          </EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Class</Th>
                  <Th>Year</Th>
                  <Th>Semester</Th>
                  <Th className="text-right">Subjects</Th>
                  <Th className="text-right">Students</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((klass) => (
                  <tr key={klass.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        to={`/admin/classes/${klass.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {klass.name}
                      </Link>
                      <span className="ml-2 text-slate-500">Section {klass.section}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{klass.academicYear}</Td>
                    <Td className="text-slate-500">{klass.semester}</Td>
                    <Td className="text-right tabular-nums">{klass._count.subjects}</Td>
                    <Td className="text-right tabular-nums">{klass._count.enrollments}</Td>
                    <Td className="text-right">
                      <Link
                        to={`/admin/classes/${klass.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Manage
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <CreateClassModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reload();
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function CreateClassModal({ open, onClose, onCreated }) {
  const emptyForm = { name: '', section: '', academicYear: '', semester: '1' };
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  function close() {
    setForm(emptyForm);
    setFieldErrors({});
    setFormError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');

    try {
      await api.post('/classes', form);
      setForm(emptyForm);
      onCreated();
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
      onClose={close}
      title="New class"
      description="One row per class and section, e.g. BCA Year 2 / Section A"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-class-form" loading={submitting}>
            Create class
          </Button>
        </>
      }
    >
      <form id="create-class-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="Class name"
          name="name"
          placeholder="e.g. BCA Year 2"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Section"
            name="section"
            placeholder="e.g. A"
            value={form.section}
            onChange={update('section')}
            error={fieldErrors.section}
            required
          />
          <Field
            label="Semester"
            name="semester"
            type="number"
            min="1"
            max="12"
            value={form.semester}
            onChange={update('semester')}
            error={fieldErrors.semester}
            required
          />
        </div>

        <Field
          label="Academic year"
          name="academicYear"
          placeholder="e.g. 2025-26"
          hint="Format: 2025-26"
          value={form.academicYear}
          onChange={update('academicYear')}
          error={fieldErrors.academicYear}
          required
        />

        <p className="text-xs text-slate-500">
          A class is identified by name + section + academic year, so the same class name can exist
          in several sections and years.
        </p>
      </form>
    </Modal>
  );
}

/** Small badge used on the detail page header too. */
export function ClassBadge({ klass }) {
  return (
    <Badge tone="brand">
      {klass.academicYear} · Sem {klass.semester}
    </Badge>
  );
}
