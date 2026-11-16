/**
 * Teacher → Mark attendance
 *
 * Pick a subject, date and period, then set a status for each student.
 *
 * Mobile-first: on phones each student is a row of four big tap targets.
 * The same markup becomes a compact table row on wider screens.
 */
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { Modal } from '../../components/Modal.jsx';
import { STATUS_LABEL } from '../../components/AttendanceViews.jsx';
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

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

/** Button colours for the selected state of each status. */
const STATUS_ACTIVE = {
  PRESENT: 'bg-emerald-600 text-white ring-emerald-600',
  ABSENT: 'bg-rose-600 text-white ring-rose-600',
  LATE: 'bg-amber-500 text-white ring-amber-500',
  EXCUSED: 'bg-slate-500 text-white ring-slate-500',
};

/** Today's date as YYYY-MM-DD in the browser's timezone. */
function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function MarkAttendancePage() {
  const { context } = useAuth();
  const subjects = context.subjects ?? [];

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [date, setDate] = useState(todayString());
  const [periodNo, setPeriodNo] = useState('1');

  /** studentId -> status. Local edits before saving. */
  const [marks, setMarks] = useState({});
  /** The sheet the current `marks` were seeded from, so switching reloads them. */
  const [seededKey, setSeededKey] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [editReason, setEditReason] = useState('');

  const sheetKey = `${subjectId}|${date}|${periodNo}`;

  const { data, loading, error, reload } = useAsyncData(
    () =>
      subjectId && date
        ? api.get(
            `/attendance/sheet?subjectId=${subjectId}&date=${date}&periodNo=${periodNo}`
          )
        : Promise.resolve(null),
    [subjectId, date, periodNo]
  );

  // Seed the local marks from the server sheet whenever the selection changes.
  if (data && seededKey !== sheetKey) {
    setSeededKey(sheetKey);
    setMarks(Object.fromEntries(data.students.map((s) => [s.id, s.status])));
    setSaveError('');
    setSaved('');
    setEditReason('');
  }

  const students = data?.students ?? [];

  /** Which rows differ from what's saved — this is what makes it an "edit". */
  const changedExisting = useMemo(() => {
    if (!data) return [];
    return data.students.filter((s) => s.status !== null && marks[s.id] !== s.status);
  }, [data, marks]);

  const unmarkedCount = students.filter((s) => !marks[s.id]).length;
  const counts = STATUSES.reduce((acc, status) => {
    acc[status] = students.filter((s) => marks[s.id] === status).length;
    return acc;
  }, {});

  function setStatus(studentId, status) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
    setSaved('');
  }

  /** Bulk helper — the usual case is "everyone present except a few". */
  function markAll(status) {
    setMarks(Object.fromEntries(students.map((s) => [s.id, status])));
    setSaved('');
  }

  async function save(reason) {
    setSaving(true);
    setSaveError('');
    setSaved('');

    // Only send students that actually have a status set.
    const records = students
      .filter((s) => marks[s.id])
      .map((s) => ({ studentId: s.id, status: marks[s.id] }));

    try {
      const result = await api.post('/attendance/mark', {
        subjectId,
        date,
        periodNo: Number(periodNo),
        records,
        ...(reason ? { editReason: reason } : {}),
      });

      const parts = [];
      if (result.created) parts.push(`${result.created} saved`);
      if (result.updated) parts.push(`${result.updated} changed`);
      if (result.unchanged) parts.push(`${result.unchanged} unchanged`);
      setSaved(parts.join(', ') || 'Nothing to save');

      setReasonOpen(false);
      setEditReason('');
      // Re-read so edit markers and timestamps reflect what's stored.
      setSeededKey(null);
      reload();
    } catch (err) {
      setSaveError(readFormError(err).formError || err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    // Changing saved attendance needs a logged reason, so ask for one first.
    if (changedExisting.length > 0) setReasonOpen(true);
    else save();
  }

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader title="Mark attendance" />
        <Card>
          <EmptyState title="You have no subjects assigned">
            An administrator needs to assign you to a subject before you can mark attendance.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Mark attendance" subtitle="Choose a subject, date and period" />

      {/* ---------------- Selection ---------------- */}
      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Subject"
            name="subjectId"
            className="lg:col-span-2"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjects.map((s) => ({
              value: s.id,
              label: `${s.name} — ${s.class.name} ${s.class.section}`,
            }))}
          />
          <Field
            label="Date"
            name="date"
            type="date"
            max={todayString()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Select
            label="Period"
            name="periodNo"
            value={periodNo}
            onChange={(e) => setPeriodNo(e.target.value)}
            options={Array.from({ length: 8 }, (_, i) => ({
              value: String(i + 1),
              label: `Period ${i + 1}`,
            }))}
          />
        </div>
      </Card>

      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}
      {saveError && (
        <Alert tone="error" className="mb-4">
          {saveError}
        </Alert>
      )}
      {saved && (
        <Alert tone="success" className="mb-4">
          Attendance saved — {saved}.
        </Alert>
      )}

      {/* Warn before the teacher does work they can't save. */}
      {data && !data.editable && (
        <Alert tone="warning" className="mb-4" title="This date cannot be marked">
          You cannot mark attendance for a future date.
        </Alert>
      )}
      {data && data.alreadyMarked && data.editable && !data.editWindow.canEdit && (
        <Alert tone="warning" className="mb-4" title="Read-only">
          This attendance is {data.editWindow.ageInDays} days old. Records can only be changed within{' '}
          {data.editWindow.windowDays} days, so existing marks are locked.
        </Alert>
      )}

      {/* ---------------- Sheet ---------------- */}
      <Card
        title={data ? `${data.subject.name} — ${data.subject.class.name} ${data.subject.class.section}` : 'Loading'}
        subtitle={
          data ? `${students.length} students${data.alreadyMarked ? ' · already marked' : ''}` : undefined
        }
        action={
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="secondary"
              className="min-h-9 px-2.5 py-1.5"
              onClick={() => markAll('PRESENT')}
              disabled={loading || students.length === 0}
            >
              All present
            </Button>
            <Button
              variant="secondary"
              className="min-h-9 px-2.5 py-1.5"
              onClick={() => setMarks({})}
              disabled={loading || students.length === 0}
            >
              Clear
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Spinner className="h-7 w-7" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState title="No students enrolled in this class">
            Enroll students from Classes &amp; subjects before marking attendance.
          </EmptyState>
        ) : (
          <>
            {/* Live tally so the teacher can sanity-check before saving. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUSES.map((status) =>
                counts[status] > 0 ? (
                  <Badge key={status} tone={STATUS_TONE_BADGE[status]}>
                    {STATUS_LABEL[status]}: {counts[status]}
                  </Badge>
                ) : null
              )}
              {unmarkedCount > 0 && <Badge tone="slate">Unmarked: {unmarkedCount}</Badge>}
            </div>

            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 sm:flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {student.rollNo && (
                        <span className="mr-2 tabular-nums text-slate-500">{student.rollNo}</span>
                      )}
                      {student.name}
                    </p>
                    {student.editedAt && (
                      <p className="text-xs text-slate-400" title={student.editReason ?? ''}>
                        Edited previously{student.editReason ? ` — ${student.editReason}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Four equal tap targets; full width on phones. */}
                  <div className="grid grid-cols-4 gap-1.5 sm:w-80">
                    {STATUSES.map((status) => {
                      const active = marks[student.id] === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatus(student.id, status)}
                          aria-pressed={active}
                          className={cx(
                            'min-h-11 rounded-lg px-1 text-xs font-semibold uppercase ring-1 transition-colors',
                            active
                              ? STATUS_ACTIVE[status]
                              : 'bg-white text-slate-500 ring-slate-300 hover:bg-slate-50'
                          )}
                        >
                          {status.charAt(0)}
                          <span className="ml-1 hidden sm:inline">{status.slice(1, 3).toLowerCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            {/* Sticky save bar so it's always reachable on a long roster. */}
            <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:-mx-5 sm:px-5">
              <p className="text-xs text-slate-500">
                {changedExisting.length > 0
                  ? `${changedExisting.length} saved record(s) will be changed — a reason is required.`
                  : unmarkedCount > 0
                    ? `${unmarkedCount} student(s) not marked yet — they will be skipped.`
                    : 'All students marked.'}
              </p>
              <Button
                onClick={handleSaveClick}
                loading={saving}
                disabled={!data?.editable || students.length === 0}
              >
                Save attendance
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* ---------------- Reason prompt for edits ---------------- */}
      <Modal
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="Why are you changing this?"
        description="Changes to saved attendance are logged against your name"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReasonOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => save(editReason)} loading={saving} disabled={!editReason.trim()}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">
            {changedExisting.length} student(s) already had attendance saved for this date.
          </Alert>

          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {changedExisting.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 text-slate-600">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-xs">
                  {STATUS_LABEL[s.status]} → <strong>{STATUS_LABEL[marks[s.id]]}</strong>
                </span>
              </li>
            ))}
          </ul>

          <Textarea
            label="Reason"
            name="editReason"
            rows={3}
            placeholder="e.g. Student produced a medical certificate"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            hint="Stored with the record, so the change can be explained later."
          />
        </div>
      </Modal>
    </>
  );
}

/** Badge tones (kept local — these are the marking screen's own tally chips). */
const STATUS_TONE_BADGE = {
  PRESENT: 'green',
  ABSENT: 'rose',
  LATE: 'amber',
  EXCUSED: 'slate',
};
