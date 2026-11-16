/**
 * Teacher → Assignments → grade one assignment
 *
 * Every enrolled student is listed, whether or not they submitted, so gaps are
 * visible. Marks are entered inline and saved per row; publishing is a separate,
 * deliberate step so a whole class can be graded before anyone sees a result.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readFormError, readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
// Staff labels: teachers do see marks, so "Graded" is the accurate word here.
import { FileLink, STAFF_STATUS_META, formatDateTime } from '../../components/AssignmentViews.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function GradeAssignmentPage() {
  const { id } = useParams();
  const { user } = useAuth();

  // This page is reachable from the teacher's own list and from the admin's
  // college-wide list, so "back" has to point wherever the user came from.
  const isAdmin = user?.role === 'ADMIN';
  const backTo = isAdmin ? '/admin/assignments' : '/teacher/assignments';

  const { data, loading, error, reload } = useAsyncData(
    () => api.get(`/assignments/${id}/submissions`),
    [id]
  );

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [flash, setFlash] = useState('');

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Grade assignment" />
        <Alert tone="error">{readLoadError(error)}</Alert>
        <Link to={backTo} className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← Back to assignments
        </Link>
      </>
    );
  }

  const { assignment, rows, stats } = data;

  async function publishAll(isPublished) {
    setPublishing(true);
    setPublishError('');
    try {
      const result = await api.post(`/assignments/${id}/publish`, { isPublished });
      setPublishOpen(false);
      setFlash(
        isPublished
          ? `Released ${result.updated} result(s) to the marksheet. Students see the assignment as "Evaluated"; the marks themselves appear on their marksheet.`
          : `Withdrew ${result.updated} result(s) from the marksheet.`
      );
      reload();
    } catch (err) {
      setPublishError(readFormError(err).formError || err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <Link to={backTo} className="mb-2 inline-block text-sm text-brand-600 hover:underline">
        ← All assignments
      </Link>

      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.subject.name} · ${assignment.subject.class.name} ${assignment.subject.class.section} · out of ${assignment.maxMarks} · due ${formatDateTime(assignment.dueDate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {assignment.hasFile && (
              <FileLink url={assignment.fileDownloadUrl} name={assignment.fileName} />
            )}
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => setPublishOpen(true)}
              disabled={stats.graded === 0}
            >
              Release results
            </Button>
          </div>
        }
      />

      {flash && (
        <Alert tone="success" className="mb-4">
          {flash}
        </Alert>
      )}

      {/* --- Progress --- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted" value={`${stats.submitted}/${stats.total}`} />
        <Stat label="Late" value={stats.late} tone={stats.late > 0 ? 'amber' : undefined} />
        <Stat label="Graded" value={`${stats.graded}/${stats.submitted}`} />
        <Stat
          label="Published"
          value={stats.published}
          tone={stats.published > 0 ? 'green' : undefined}
        />
      </div>

      <Card title="Submissions" subtitle="Students who have not submitted are listed too">
        {rows.length === 0 ? (
          <EmptyState title="No students enrolled in this class" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Roll no.</Th>
                  <Th>Student</Th>
                  <Th>Status</Th>
                  <Th>File</Th>
                  <Th className="w-28">Marks</Th>
                  <Th>Feedback</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <GradeRow
                    key={row.student.id}
                    row={row}
                    maxMarks={assignment.maxMarks}
                    onSaved={reload}
                  />
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <ConfirmDialog
        open={publishOpen}
        onClose={() => {
          setPublishOpen(false);
          setPublishError('');
        }}
        onConfirm={() => publishAll(true)}
        loading={publishing}
        error={publishError}
        variant="primary"
        title="Release results to the marksheet?"
        message={`${stats.graded} graded submission(s) will be released. The marks go to each student's marksheet — they are never shown on the assignments page. Ungraded submissions are left alone, and you can withdraw a release afterwards.`}
        confirmLabel="Release results"
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One student's row. Marks and feedback are local state until saved, so the
 * teacher can tab through a class without a request per keystroke.
 */
function GradeRow({ row, maxMarks, onSaved }) {
  const submission = row.submission;

  const [marks, setMarks] = useState(
    submission?.marksObtained === null || submission?.marksObtained === undefined
      ? ''
      : String(submission.marksObtained)
  );
  const [feedback, setFeedback] = useState(submission?.feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const status = STAFF_STATUS_META[row.status] ?? STAFF_STATUS_META.PENDING;

  const dirty =
    submission &&
    (marks !== (submission.marksObtained === null ? '' : String(submission.marksObtained)) ||
      feedback !== (submission.feedback ?? ''));

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/assignments/submissions/${submission.id}/grade`, {
        // Empty input clears the mark rather than scoring zero.
        marksObtained: marks === '' ? null : Number(marks),
        feedback,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onSaved();
    } catch (err) {
      setError(readFormError(err).fieldErrors.marksObtained || readFormError(err).formError || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={cx('align-top hover:bg-slate-50', !submission && 'bg-slate-50/50')}>
      <Td className="whitespace-nowrap tabular-nums font-medium">{row.student.rollNo || '—'}</Td>
      <Td>
        <span className="font-medium text-slate-900">{row.student.name}</span>
        <span className="block text-xs text-slate-500">{row.student.email}</span>
      </Td>
      <Td>
        <Badge tone={status.tone}>{status.label}</Badge>
        {submission?.isLate && (
          <Badge tone="rose" className="ml-1">
            Late
          </Badge>
        )}
        {submission?.isPublished && (
          <span className="mt-1 block text-xs text-emerald-600">Published</span>
        )}
      </Td>
      <Td>
        {submission?.hasFile ? (
          <>
            <FileLink url={submission.fileDownloadUrl} name={submission.fileName} />
            <span className="mt-1 block text-xs text-slate-400">
              {formatDateTime(submission.submittedAt)}
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-400">No submission</span>
        )}
      </Td>
      <Td>
        {submission ? (
          <div>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                min="0"
                max={maxMarks}
                step="0.5"
                value={marks}
                onChange={(e) => {
                  setMarks(e.target.value);
                  setError('');
                }}
                placeholder="—"
                aria-label={`Marks for ${row.student.name}`}
                className={cx(
                  'min-h-10 w-16 rounded-lg border px-2 py-1.5 text-sm tabular-nums',
                  error ? 'border-rose-400' : 'border-slate-300'
                )}
              />
              <span className="text-xs text-slate-500">/{maxMarks}</span>
            </div>
            {submission.grade && !dirty && (
              <span className="mt-1 block text-xs text-slate-500">
                {submission.grade.percentage}% · {submission.grade.grade}
              </span>
            )}
            {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </Td>
      <Td>
        {submission ? (
          <textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback"
            aria-label={`Feedback for ${row.student.name}`}
            className="min-h-10 w-48 resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </Td>
      <Td className="text-right">
        {submission && (
          <Button
            variant={dirty ? 'primary' : 'secondary'}
            className="min-h-9 px-3 py-1.5"
            onClick={save}
            loading={saving}
            disabled={!dirty && !savedFlash}
          >
            {savedFlash ? 'Saved' : 'Save'}
          </Button>
        )}
      </Td>
    </tr>
  );
}

const TONE_TEXT = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', tone ? TONE_TEXT[tone] : 'text-slate-900')}>
        {value}
      </p>
    </div>
  );
}
