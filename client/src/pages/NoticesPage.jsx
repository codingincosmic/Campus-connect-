/**
 * ---------------------------------------------------------------------------
 * NOTICES — one page, shared by all four roles.
 * ---------------------------------------------------------------------------
 *
 * The server already scopes the feed to the caller's audience, so every role
 * can use the same component. The only role-dependent bits are the compose
 * button (staff only) and the edit/delete actions (author or admin).
 *
 * Mounted at /admin/notices, /teacher/notices, /student/notices and
 * /parent/notices so it slots into each role's existing nav.
 */
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, toFormData } from '../api/client.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { readFormError, readLoadError } from '../lib/formError.js';
import { PageHeader } from '../components/AppLayout.jsx';
import { Modal, ConfirmDialog } from '../components/Modal.jsx';
import { FileLink } from '../components/AssignmentViews.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pagination,
  Select,
  Textarea,
  cx,
} from '../components/ui.jsx';
import { Spinner } from '../components/Spinner.jsx';

const AUDIENCE_TONE = { ALL: 'rose', CLASS: 'amber', SECTION: 'brand' };

export function NoticesPage() {
  const { user } = useAuth();
  const isStaff = user.role === 'ADMIN' || user.role === 'TEACHER';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [flash, setFlash] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  const feed = useAsyncData(
    () =>
      api.get(
        `/notices?page=${page}&pageSize=15` +
          (unreadOnly ? '&unreadOnly=true' : '') +
          (debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : '')
      ),
    [page, unreadOnly, debouncedSearch]
  );

  const unread = useAsyncData(() => api.get('/notices/unread-count'), [feed.data]);

  const items = feed.data?.items ?? [];
  const unreadCount = unread.data?.unread ?? 0;

  /** Filters change the result set, so go back to page 1. */
  function changeFilter(fn) {
    fn();
    setPage(1);
  }

  async function markAllRead() {
    try {
      const result = await api.post('/notices/read-all');
      setFlash(result.marked > 0 ? `Marked ${result.marked} notice(s) as read.` : 'Nothing unread.');
      feed.reload();
    } catch (err) {
      setFlash(readFormError(err).formError || err.message);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/notices/${confirmDelete.id}`);
      setConfirmDelete(null);
      setFlash('Notice deleted.');
      feed.reload();
    } catch (err) {
      setDeleteError(readFormError(err).formError || err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread`
            : 'Announcements from the college and your teachers'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
            {isStaff && <Button onClick={() => setEditing({})}>New notice</Button>}
          </div>
        }
      />

      {flash && (
        <Alert tone="success" className="mb-4">
          {flash}
        </Alert>
      )}
      {feed.error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(feed.error)}
        </Alert>
      )}

      {/* --- Filters --- */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Search"
            name="search"
            type="search"
            placeholder="Search notices"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
          <Button
            variant={unreadOnly ? 'primary' : 'secondary'}
            onClick={() => changeFilter(() => setUnreadOnly((v) => !v))}
          >
            {unreadOnly ? 'Showing unread' : 'Unread only'}
          </Button>
        </div>
      </Card>

      {/* --- Feed --- */}
      {feed.loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title={unreadOnly ? 'Nothing unread' : 'No notices yet'}>
            {unreadOnly
              ? 'You are up to date.'
              : isStaff
                ? 'Post the first notice for your class.'
                : 'Announcements from the college will appear here.'}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {items.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                canManage={user.role === 'ADMIN' || notice.postedBy.id === user.id}
                onRead={feed.reload}
                onEdit={() => setEditing(notice)}
                onDelete={() => setConfirmDelete(notice)}
              />
            ))}
          </div>

          <Pagination
            page={feed.data.page}
            totalPages={feed.data.totalPages}
            total={feed.data.total}
            pageSize={feed.data.pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <NoticeModal
        open={editing !== null}
        notice={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={(result) => {
          setEditing(null);
          // Spell out who actually received it. Posting to the wrong section is
          // easy and otherwise invisible until someone complains.
          setFlash(
            result?.audience
              ? `Posted to ${result.audience} — ${result.recipientCount ?? 0} student(s) will see it.`
              : 'Notice saved.'
          );
          feed.reload();
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
        title="Delete this notice?"
        message={`"${confirmDelete?.title}" will be removed for everyone who can see it.`}
        confirmLabel="Delete notice"
      />
    </>
  );
}

/* ========================================================================== */
/* One notice                                                                 */
/* ========================================================================== */

/** Long notices are collapsed until opened, so the feed stays scannable. */
const COLLAPSE_AFTER = 220;

function NoticeCard({ notice, canManage, onRead, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [isRead, setIsRead] = useState(notice.isRead);

  const isLong = notice.body.length > COLLAPSE_AFTER;
  const shown = expanded || !isLong ? notice.body : `${notice.body.slice(0, COLLAPSE_AFTER)}…`;

  /** Opening a notice is what counts as reading it. */
  async function open() {
    setExpanded((v) => !v);
    if (!isRead) {
      setIsRead(true); // optimistic, so the dot clears immediately
      try {
        await api.post(`/notices/${notice.id}/read`);
        onRead?.();
      } catch {
        // Not being able to record the read is not worth interrupting anyone.
        setIsRead(false);
      }
    }
  }

  return (
    <Card className={cx(!isRead && 'ring-2 ring-brand-200')}>
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <span
          aria-hidden="true"
          className={cx(
            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
            isRead ? 'bg-transparent' : 'bg-brand-600'
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cx('text-sm text-slate-900', isRead ? 'font-medium' : 'font-semibold')}>
              {notice.title}
            </h3>
            <Badge tone={AUDIENCE_TONE[notice.targetType] ?? 'slate'}>{notice.audience}</Badge>
            {!isRead && <Badge tone="brand">New</Badge>}
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {notice.postedBy.name}
            <span className="text-slate-400"> · {relativeTime(notice.createdAt)}</span>
          </p>

          {/* whitespace-pre-wrap keeps the author's line breaks */}
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{shown}</p>

          {isLong && (
            <button
              type="button"
              onClick={open}
              className="mt-1 text-xs font-medium text-brand-600 hover:underline"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {notice.hasFile && <FileLink url={notice.fileDownloadUrl} name={notice.fileName} />}

            {!isRead && !isLong && (
              <button
                type="button"
                onClick={open}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Mark as read
              </button>
            )}

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ========================================================================== */
/* Compose / edit                                                             */
/* ========================================================================== */

function NoticeModal({ open, notice, onClose, onSaved }) {
  const isEdit = Boolean(notice);
  const blank = { title: '', body: '', targetType: 'SECTION', targetClassId: '' };

  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  // Which audiences this user is allowed to address.
  const targets = useAsyncData(
    () => (open ? api.get('/notices/targets') : Promise.resolve(null)),
    [open]
  );
  const options = targets.data;

  // Refill the form when the modal opens for a different notice.
  const key = notice?.id ?? (open ? 'new' : null);
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setForm(
      notice
        ? {
            title: notice.title,
            body: notice.body,
            targetType: notice.targetType,
            targetClassId: notice.targetClassId ?? '',
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

  const needsClass = form.targetType !== 'ALL';

  /**
   * Live "who will get this" preview.
   *
   * Computed from the targets payload, so it updates as soon as the audience
   * changes — before anything is posted. This is the guard against sending a
   * notice to the wrong section, which is easy when the same class name exists
   * in several sections.
   */
  const preview = (() => {
    if (!options) return null;

    if (form.targetType === 'ALL') {
      return { label: 'Everyone in the college', count: options.totalStudents, tone: 'warning' };
    }

    const chosen = options.classes.find((c) => c.id === form.targetClassId);
    if (!chosen) return null;

    if (form.targetType === 'SECTION') {
      return {
        label: `${chosen.name} — Section ${chosen.section} (${chosen.academicYear})`,
        count: chosen.studentCount,
        tone: chosen.studentCount === 0 ? 'warning' : 'info',
      };
    }

    // CLASS: every section sharing this name and academic year.
    const sections = options.classes.filter(
      (c) => c.name === chosen.name && c.academicYear === chosen.academicYear
    );
    return {
      label: `${chosen.name} — all ${sections.length} section(s) (${chosen.academicYear})`,
      count: sections.reduce((sum, c) => sum + c.studentCount, 0),
      tone: 'info',
    };
  })();

  /** Audience choices, limited by what the server says this user may post. */
  const targetTypeOptions = [
    ...(options?.canPostCollegeWide
      ? [{ value: 'ALL', label: 'Whole college — everyone' }]
      : []),
    ...(options?.canPostWholeClass
      ? [{ value: 'CLASS', label: 'A whole class — every section' }]
      : []),
    { value: 'SECTION', label: 'One class and section' },
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');

    const fields = {
      title: form.title,
      body: form.body,
      targetType: form.targetType,
      // Only meaningful for CLASS/SECTION.
      ...(needsClass ? { targetClassId: form.targetClassId } : {}),
      ...(isEdit && removeFile ? { removeFile: 'true' } : {}),
    };

    try {
      const body = toFormData(fields, { name: 'file', file });
      const result = isEdit
        ? await api.patchForm(`/notices/${notice.id}`, body)
        : await api.postForm('/notices', body);
      onSaved(result);
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
      title={isEdit ? 'Edit notice' : 'New notice'}
      description="Choose carefully who this reaches"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="notice-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Post notice'}
          </Button>
        </>
      }
    >
      <form id="notice-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="Title"
          name="title"
          placeholder="e.g. Semester exam timetable"
          value={form.title}
          onChange={update('title')}
          error={fieldErrors.title}
          required
        />

        <Textarea
          label="Notice"
          name="body"
          rows={6}
          placeholder="Write the announcement here."
          value={form.body}
          onChange={update('body')}
          error={fieldErrors.body}
          required
        />

        {/* --- Audience --- */}
        <div className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <Select
            label="Who is this for?"
            name="targetType"
            value={form.targetType}
            onChange={update('targetType')}
            error={fieldErrors.targetType}
            options={targetTypeOptions}
          />

          {needsClass && (
            <Select
              label={form.targetType === 'CLASS' ? 'Class' : 'Class and section'}
              name="targetClassId"
              placeholder="— Choose —"
              value={form.targetClassId}
              onChange={update('targetClassId')}
              error={fieldErrors.targetClassId}
              hint={
                form.targetType === 'CLASS'
                  ? 'Reaches every section of this class in the same academic year.'
                  : 'Reaches only this exact section.'
              }
              options={(options?.classes ?? []).map((c) => ({
                value: c.id,
                // The headcount makes it obvious who is actually being reached.
                label: `${c.name} — Section ${c.section} · ${c.academicYear} (${c.studentCount} students)`,
              }))}
            />
          )}

          {/* Always show exactly who this reaches, before it is sent. */}
          {preview && (
            <Alert tone={preview.tone} title="This notice will go to">
              <p className="font-medium">{preview.label}</p>
              <p className="mt-0.5">
                {preview.count === 0 ? (
                  <span className="font-medium">
                    No students are enrolled here — nobody will see this notice.
                  </span>
                ) : (
                  <>
                    <strong>{preview.count}</strong> student
                    {preview.count === 1 ? '' : 's'}
                    {form.targetType === 'ALL' && ', plus their parents and all teachers'}
                    {form.targetType !== 'ALL' && ' and their linked parents'}
                  </>
                )}
              </p>
            </Alert>
          )}

          {needsClass && !form.targetClassId && (
            <p className="text-xs text-slate-500">
              Choose a class to see who will receive this notice.
            </p>
          )}
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
          <p className="mt-1.5 text-xs text-slate-500">Optional — a circular, timetable or form.</p>

          {isEdit && notice.hasFile && !file && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={removeFile}
                onChange={(e) => setRemoveFile(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Remove the current attachment ({notice.fileName})
            </label>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** "3 hours ago" reads better than a timestamp in a feed. */
function relativeTime(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
