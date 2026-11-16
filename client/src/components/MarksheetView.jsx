/**
 * ---------------------------------------------------------------------------
 * MARKSHEET — shared by the student and parent results pages.
 * ---------------------------------------------------------------------------
 *
 * Shows, for one student:
 *   • headline CGPA / overall percentage / credits
 *   • one block per semester, with a subject table and that semester's SGPA
 *   • performance over time
 *
 * Marks reach this screen only once a teacher has RELEASED them; assignment
 * screens never show a number.
 */
import { Badge, Card, EmptyState, TableWrap, Td, Th, cx } from './ui.jsx';

/** Colour a grade by how comfortable it is. */
function gradeTone(percentage, passMark) {
  if (percentage === null || percentage === undefined) return 'slate';
  if (percentage < passMark) return 'rose';
  if (percentage < passMark + 20) return 'amber';
  return 'green';
}

const TONE_TEXT = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  slate: 'text-slate-400',
};

const TONE_BAR = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-300',
};

const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

/* -------------------------------------------------------------------------- */

export function MarksheetView({ data }) {
  const { semesters, cgpa, overall, timeline, scale } = data;
  const passMark = scale.passPercentage;

  const hasAnyResult = overall.subjectsGraded > 0;

  if (!hasAnyResult) {
    return (
      <Card>
        <EmptyState title="No results published yet">
          Marks appear here once your teachers have graded work and released the results.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {/* --- Headline --- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat
          label={`CGPA (of ${scale.gpaScale})`}
          value={fmt(cgpa)}
          tone={cgpa === null ? 'slate' : cgpa >= scale.gpaScale * 0.6 ? 'green' : 'amber'}
        />
        <BigStat
          label="Overall"
          value={fmt(overall.percentage, '%')}
          tone={gradeTone(overall.percentage, passMark)}
        />
        <BigStat
          label="Credits earned"
          value={`${overall.creditsEarned}/${overall.creditsAttempted}`}
        />
        <BigStat
          label="Subjects passed"
          value={`${overall.subjectsPassed}/${overall.subjectsGraded}`}
          tone={overall.subjectsFailed > 0 ? 'rose' : 'green'}
        />
      </div>

      {overall.subjectsFailed > 0 && (
        <Card>
          <p className="text-sm text-rose-700">
            <strong>
              {overall.subjectsFailed} subject{overall.subjectsFailed === 1 ? '' : 's'}
            </strong>{' '}
            below the {passMark}% pass mark. Speak to the subject teacher about re-assessment.
          </p>
        </Card>
      )}

      {/* --- One block per semester --- */}
      {semesters.map((sem) => (
        <Card
          key={sem.classId}
          title={`${sem.className} · Semester ${sem.semester}`}
          subtitle={`${sem.academicYear} · ${sem.subjectsGraded} of ${sem.subjectsTotal} subjects released`}
          action={
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">SGPA</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{fmt(sem.sgpa)}</p>
            </div>
          }
        >
          <TableWrap>
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Subject</Th>
                  <Th className="text-right">Credits</Th>
                  <Th className="text-right">Marks</Th>
                  <Th className="text-right">%</Th>
                  <Th>Grade</Th>
                  <Th className="text-right">Points</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sem.subjects.map((subject) => {
                  const tone = gradeTone(subject.percentage, passMark);
                  const pending = subject.percentage === null;

                  return (
                    <tr key={subject.subjectId} className={cx(pending && 'opacity-60')}>
                      <Td>
                        <span className="font-medium text-slate-900">{subject.name}</span>
                        {subject.code && (
                          <span className="block text-xs text-slate-500">{subject.code}</span>
                        )}
                        {!pending && (
                          <span className="block text-xs text-slate-400">
                            {subject.assessmentCount} assessment
                            {subject.assessmentCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{subject.credits}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {pending ? '—' : `${subject.marksObtained}/${subject.maxMarks}`}
                      </Td>
                      <Td className={cx('text-right font-medium tabular-nums', TONE_TEXT[tone])}>
                        {fmt(subject.percentage, '%')}
                      </Td>
                      <Td>
                        {pending ? (
                          <span className="text-xs text-slate-400">Awaiting results</span>
                        ) : (
                          <>
                            <Badge tone={tone}>{subject.grade}</Badge>
                            {subject.passed === false && (
                              <Badge tone="rose" className="ml-1">
                                Fail
                              </Badge>
                            )}
                          </>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{fmt(subject.gradePoint)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>

          <p className="mt-3 text-xs text-slate-500">
            SGPA is credit-weighted: sum(grade point × credits) ÷ sum(credits), counting only
            subjects with released results.
          </p>
        </Card>
      ))}

      {/* --- Performance over time --- */}
      {timeline.length > 1 && (
        <Card title="Performance over time" subtitle="Each assessment, oldest first">
          <PerformanceChart timeline={timeline} passMark={passMark} />
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BigStat({ label, value, tone = 'slate' }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cx(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'slate' ? 'text-slate-900' : TONE_TEXT[tone]
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * A plain CSS bar chart. A charting library would be a lot of bundle weight for
 * one small visual, and this stays readable on a phone.
 */
function PerformanceChart({ timeline, passMark }) {
  return (
    <div>
      <div className="relative flex items-end gap-2 overflow-x-auto pb-1">
        {/* Pass-mark reference line */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-rose-300"
          style={{ bottom: `calc(1.75rem + ${passMark}% * 0.01 * 7rem)` }}
          aria-hidden="true"
        />
        {timeline.map((point, index) => {
          const tone = gradeTone(point.percentage, passMark);
          return (
            <div key={index} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <span className={cx('text-xs font-medium tabular-nums', TONE_TEXT[tone])}>
                {point.percentage}%
              </span>
              <div className="flex h-28 w-full items-end rounded bg-slate-100">
                <div
                  className={cx('w-full rounded transition-all', TONE_BAR[tone])}
                  style={{ height: `${Math.max(2, point.percentage)}%` }}
                  title={`${point.title}: ${point.marksObtained}/${point.maxMarks}`}
                />
              </div>
              <span className="line-clamp-2 h-7 text-center text-[10px] leading-tight text-slate-500">
                {point.title}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        The dashed line is the {passMark}% pass mark. Hover a bar for the raw marks.
      </p>
    </div>
  );
}
