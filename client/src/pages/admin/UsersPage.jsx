/**
 * Admin → Students & parents (and teachers/admins)
 *
 * The college creates every account here — there is no public signup.
 * Actions per row: reset password, activate/deactivate, and for parents,
 * manage which students they are linked to.
 */
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal, ConfirmDialog } from '../../components/Modal.jsx';
import { CredentialsDialog } from '../../components/CredentialsDialog.jsx';
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
  cx,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

const ROLE_TABS = [
  { value: '', label: 'All' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'PARENT', label: 'Parents' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'ADMIN', label: 'Admins' },
];

const ROLE_TONE = { ADMIN: 'rose', TEACHER: 'brand', STUDENT: 'green', PARENT: 'amber' };

export function UsersPage() {
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, loading, error, reload } = useAsyncData(
    () =>
      api.get(
        `/users?page=${page}&pageSize=25` +
          (role ? `&role=${role}` : '') +
          (debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : '')
      ),
    [page, role, debouncedSearch]
  );

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState(null); // { user, tempPassword, title }
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [childrenTarget, setChildrenTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [rowError, setRowError] = useState('');

  const users = data?.items ?? [];

  /** Changing filters must reset to page 1, or you can land on an empty page. */
  function changeRole(next) {
    setRole(next);
    setPage(1);
  }
  function changeSearch(next) {
    setSearch(next);
    setPage(1);
  }

  async function handleReset() {
    setResetting(true);
    setResetError('');
    try {
      const result = await api.post(`/users/${resetTarget.id}/reset-password`, {});
      const target = resetTarget;
      setResetTarget(null);
      setCredentials({
        user: target,
        tempPassword: result.tempPassword,
        title: 'Password reset',
      });
      reload();
    } catch (err) {
      setResetError(readFormError(err).formError || err.message);
    } finally {
      setResetting(false);
    }
  }

  async function toggleActive(user) {
    setTogglingId(user.id);
    setRowError('');
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      reload();
    } catch (err) {
      setRowError(readFormError(err).formError || err.message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Students & parents"
        subtitle="Create and manage every account in the college"
        action={<Button onClick={() => setCreateOpen(true)}>New account</Button>}
      />

      {rowError && (
        <Alert tone="error" className="mb-4">
          {rowError}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}

      <Card>
        {/* --- Filters --- */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by role">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={role === tab.value}
                onClick={() => changeRole(tab.value)}
                className={cx(
                  'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  role === tab.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Field
            label="Search"
            name="search"
            type="search"
            placeholder="Name, email, username or roll number"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>

        {/* --- Table --- */}
        {loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="No accounts found">
            {search ? 'Try a different search term.' : 'Create the first account to get started.'}
          </EmptyState>
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[44rem] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Login</Th>
                    <Th>Roll no.</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-medium text-slate-900">{user.name}</span>
                        <span className="block text-xs text-slate-500">{user.email}</span>
                      </Td>
                      <Td>
                        <Badge tone={ROLE_TONE[user.role]}>{user.role.toLowerCase()}</Badge>
                      </Td>
                      <Td className="text-slate-500">{user.username || '—'}</Td>
                      <Td className="tabular-nums text-slate-500">{user.rollNo || '—'}</Td>
                      <Td>
                        {user.isActive ? (
                          <span className="text-emerald-700">Active</span>
                        ) : (
                          <span className="text-rose-700">Inactive</span>
                        )}
                        {user.mustChangePassword && (
                          <span className="block text-xs text-amber-600">Must change password</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {user.role === 'PARENT' && (
                          <button
                            type="button"
                            onClick={() => setChildrenTarget(user)}
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            Children ({user._count.parentLinks})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setResetTarget(user)}
                          className="ml-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(user)}
                          disabled={togglingId === user.id}
                          className={cx(
                            'ml-3 text-sm font-medium hover:underline disabled:opacity-50',
                            user.isActive ? 'text-rose-600' : 'text-emerald-600'
                          )}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
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
      </Card>

      {/* --- Dialogs --- */}

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          reload();
          if (result.tempPassword) {
            setCredentials({
              user: result.user,
              tempPassword: result.tempPassword,
              title: 'Account created',
            });
          }
        }}
      />

      <CredentialsDialog
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        user={credentials?.user}
        tempPassword={credentials?.tempPassword}
        title={credentials?.title}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => {
          setResetTarget(null);
          setResetError('');
        }}
        onConfirm={handleReset}
        loading={resetting}
        error={resetError}
        variant="primary"
        title="Reset this password?"
        message={`A new temporary password will be generated for ${resetTarget?.name}. Their current password stops working immediately, and they must choose a new one at next login.`}
        confirmLabel="Reset password"
      />

      <ManageChildrenModal
        open={Boolean(childrenTarget)}
        parent={childrenTarget}
        onClose={() => {
          setChildrenTarget(null);
          reload();
        }}
      />
    </>
  );
}

/* ========================================================================== */
/* Create account                                                             */
/* ========================================================================== */

function CreateUserModal({ open, onClose, onCreated }) {
  const blank = {
    name: '',
    email: '',
    username: '',
    role: 'STUDENT',
    rollNo: '',
    phone: '',
    classId: '',
  };

  const [form, setForm] = useState(blank);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Class list, so a new student can be enrolled straight away.
  const { data: classData } = useAsyncData(
    () => (open ? api.get('/classes') : Promise.resolve(null)),
    [open]
  );
  const classes = classData?.items ?? [];

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  function close() {
    setForm(blank);
    setFieldErrors({});
    setFormError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');

    // Send only the fields that apply to the chosen role.
    const payload = {
      name: form.name,
      email: form.email,
      username: form.username,
      role: form.role,
      phone: form.phone,
      ...(form.role === 'STUDENT' ? { rollNo: form.rollNo, classId: form.classId } : {}),
    };

    try {
      const result = await api.post('/users', payload);
      setForm(blank);
      onCreated(result);
    } catch (err) {
      const parsed = readFormError(err);
      setFieldErrors(parsed.fieldErrors);
      setFormError(parsed.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const isStudent = form.role === 'STUDENT';

  return (
    <Modal
      open={open}
      onClose={close}
      title="New account"
      description="A temporary password is generated and shown once"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" loading={submitting}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Select
          label="Role"
          name="role"
          value={form.role}
          onChange={update('role')}
          error={fieldErrors.role}
          options={[
            { value: 'STUDENT', label: 'Student' },
            { value: 'PARENT', label: 'Parent' },
            { value: 'TEACHER', label: 'Teacher' },
            { value: 'ADMIN', label: 'Administrator' },
          ]}
        />

        <Field
          label="Full name"
          name="name"
          placeholder="e.g. Aarav Sharma"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          required
        />

        <Field
          label="Email"
          name="email"
          type="email"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="e.g. aarav@student.college.edu"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Username"
            name="username"
            autoCapitalize="none"
            spellCheck="false"
            hint="Optional — an easier login than the email"
            placeholder="e.g. bca2301"
            value={form.username}
            onChange={update('username')}
            error={fieldErrors.username}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            hint="Optional"
            value={form.phone}
            onChange={update('phone')}
            error={fieldErrors.phone}
          />
        </div>

        {/* Student-only fields */}
        {isStudent && (
          <div className="grid gap-4 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-2">
            <Field
              label="Roll number"
              name="rollNo"
              placeholder="e.g. BCA2309"
              value={form.rollNo}
              onChange={update('rollNo')}
              error={fieldErrors.rollNo}
              required
            />
            <Select
              label="Enroll in class"
              name="classId"
              placeholder="— Choose later —"
              value={form.classId}
              onChange={update('classId')}
              error={fieldErrors.classId}
              options={classes.map((c) => ({
                value: c.id,
                label: `${c.name} — ${c.section} (${c.academicYear})`,
              }))}
            />
          </div>
        )}

        {form.role === 'PARENT' && (
          <Alert tone="info">
            Create the parent account first, then use <strong>Children</strong> on their row to link
            them to their students.
          </Alert>
        )}
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* Parent → children links                                                    */
/* ========================================================================== */

function ManageChildrenModal({ open, parent, onClose }) {
  const [search, setSearch] = useState('');
  const [relationship, setRelationship] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  const linked = useAsyncData(
    () => (open && parent ? api.get(`/users/${parent.id}/children`) : Promise.resolve(null)),
    [open, parent?.id]
  );

  const candidates = useAsyncData(
    () =>
      open
        ? api.get(
            '/users?role=STUDENT&pageSize=50&isActive=true' +
              (debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : '')
          )
        : Promise.resolve(null),
    [open, debouncedSearch]
  );

  const children = linked.data?.items ?? [];
  const linkedIds = new Set(children.map((c) => c.id));
  // Don't offer students who are already linked to this parent.
  const available = (candidates.data?.items ?? []).filter((s) => !linkedIds.has(s.id));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function link() {
    setBusy(true);
    setFormError('');
    try {
      await api.post(`/users/${parent.id}/children`, {
        studentIds: [...selected],
        relationship: relationship || undefined,
      });
      setSelected(new Set());
      setSearch('');
      linked.reload();
    } catch (err) {
      setFormError(readFormError(err).formError || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink(studentId) {
    setBusy(true);
    setFormError('');
    try {
      await api.delete(`/users/${parent.id}/children/${studentId}`);
      linked.reload();
    } catch (err) {
      setFormError(readFormError(err).formError || err.message);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setSelected(new Set());
    setSearch('');
    setRelationship('');
    setFormError('');
    onClose();
  }

  if (!parent) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Children of ${parent.name}`}
      description="A parent can be linked to several students"
      size="lg"
      footer={<Button onClick={close}>Done</Button>}
    >
      <div className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        {/* --- Currently linked --- */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Linked students ({children.length})
          </h3>
          {linked.loading ? (
            <div className="flex justify-center py-4 text-slate-400">
              <Spinner className="h-5 w-5" />
            </div>
          ) : children.length === 0 ? (
            <EmptyState title="No students linked yet" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {children.map((child) => (
                <li key={child.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {child.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {child.rollNo ? `${child.rollNo} · ` : ''}
                      {child.classes.map((c) => `${c.name} ${c.section}`).join(', ') ||
                        'Not enrolled'}
                      {child.relationship ? ` · ${child.relationship}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => unlink(child.id)}
                    disabled={busy}
                    className="shrink-0 text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Add more --- */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Link more students
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Search students"
              name="child-search"
              type="search"
              placeholder="Name, roll number or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label="Relationship"
              name="relationship"
              placeholder="— Not specified —"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              options={[
                { value: 'Father', label: 'Father' },
                { value: 'Mother', label: 'Mother' },
                { value: 'Guardian', label: 'Guardian' },
              ]}
            />
          </div>

          {candidates.loading ? (
            <div className="flex justify-center py-6 text-slate-400">
              <Spinner className="h-5 w-5" />
            </div>
          ) : available.length === 0 ? (
            <EmptyState title="No students available to link" />
          ) : (
            <>
            <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200">
              {available.map((student) => (
                <li key={student.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
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
            <TruncationNotice
              shown={available.length}
              total={candidates.data?.total ?? 0}
              noun="students"
            />
            </>
          )}

          <Button
            className="mt-3"
            onClick={link}
            loading={busy}
            disabled={selected.size === 0}
          >
            Link {selected.size > 0 ? `${selected.size} student${selected.size === 1 ? '' : 's'}` : ''}
          </Button>
        </section>
      </div>
    </Modal>
  );
}
