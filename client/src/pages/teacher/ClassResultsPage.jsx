/**
 * Teacher / Admin → Results
 *
 * The class gradebook: every student as a row, every subject as a column,
 * with SGPA and a CSV export for the office.
 *
 * Used by both teachers (classes they teach in) and admins (any class) — the
 * server applies the visibility rule.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Select,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui.jsx';
import { Spinner } from '../../components/Spinner.jsx';

const TONE_TEXT = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  slate: 'text-slate-400',
};

function tone(percentage, passMark) {
  if (percentage === null || percentage === undefined) return 'slate';
  if (percentage < passMark) return 'rose';
  if (percentage < passMark + 20) return 'amber';
  return 'green';
}

export function ClassResultsPage() {
  const { user, context } = useAuth();
  const isAdmin = user.role === 'ADMIN';

  // Teachers pick from classes they teach; admins from every class.
  const classesQuery = useAsyncData(() => api.get('/classes'), []);
  const classList = classesQuery.data?.items ?? [];

  const [classId, setClassId] = useState('');
  const effectiveClassId = classId || classList[0]?.id || '';

  const results = useAsyncData(
    () => (effectiveClassId ? api.get(`/results/class/${effectiveClassId}`) : Promise.resolve(null)),
    [effectiveClassId]
  );

  const data = results.data;
  const passMark = data?.scale.passPercentage ?? 40;

  if (!classesQuery.loading && classList.length === 0) {
    return (
      <>
        <PageHeader title="Results" />
        <Card>
          <EmptyState title={isAdmin ? 'No classes yet' : 'You have no classes'}>
            {isAdmin
              ? 'Create a class and add subjects before results can be produced.'
              : 'An administrator needs to assign you to a subject first.'}
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Results"
        subtitle="Subject-wise marks and SGPA for a whole class"
        action={
          data && (
            /* Plain link so the browser handles the download and sends the cookie. */
            <a
              href={`/api/results/class/${effectiveClassId}/csv`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Download CSV
            </a>
          )
        }
      />

      <Card className="mb-4">
        <Select
          label="Class"
          name="classId"
          value={effectiveClassId}
          onChange={(e) => setClassId(e.target.value)}
          options={classList.map((c) => ({
            value: c.id,
            label: `${c.name} — Section ${c.section} (${c.academicYear})`,
          }))}
        />
      </Card>

      {results.error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(results.error)}
        </Alert>
      )}

      {results.loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data ? null : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Students" value={data.stats.students} />
            <Stat label="With results" value={`${data.stats.graded}/${data.stats.students}`} />
            <Stat
              label={`Average SGPA (of ${data.scale.gpaScale})`}
              value={data.stats.classAverageSgpa ?? '—'}
            />
            <Stat
              label="Students with a fail"
              value={data.stats.failing}
              tone={data.stats.failing > 0 ? 'rose' : 'green'}
            />
          </div>

          <Card
            title={`${data.class.name} — Section ${data.class.section}`}
            subtitle={`${data.class.academicYear} · Semester ${data.class.semester} · only released marks are counted`}
          >
            {data.rows.length === 0 ? (
              <EmptyState title="No students enrolled in this class" />
            ) : data.subjects.length === 0 ? (
              <EmptyState title="This class has no subjects yet" />
            ) : (
              <TableWrap>
                <table className="w-full border-collapse" style={{ minWidth: `${28 + data.subjects.length * 7}rem` }}>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>Roll no.</Th>
                      <Th>Student</Th>
                      {data.subjects.map((s) => (
                        <Th key={s.subjectId} className="text-right">
                          {s.name}
                          <span className="block font-normal normal-case text-slate-400">
                            {s.credits} cr
                          </span>
                        </Th>
                      ))}
                      <Th className="text-right">Overall</Th>
                      <Th className="text-right">SGPA</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row) => (
                      <tr
                        key={row.student.id}
                        className={cx('hover:bg-slate-50', row.subjectsFailed > 0 && 'bg-rose-50/50')}
                      >
                        <Td className="whitespace-nowrap tabular-nums font-medium">
                          {row.student.rollNo || '—'}
                        </Td>
                        <Td>
                          {row.student.name}
                          {row.subjectsFailed > 0 && (
                            <Badge tone="rose" className="ml-2">
                              {row.subjectsFailed} fail
                            </Badge>
                          )}
                        </Td>
                        {row.subjects.map((s) => (
                          <Td key={s.subjectId} className="whitespace-nowrap text-right">
                            {s.percentage === null ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <>
                                <span
                                  className={cx(
                                    'font-medium tabular-nums',
                                    TONE_TEXT[tone(s.percentage, passMark)]
                                  )}
                                >
                                  {s.grade}
                                </span>
                                <span className="block text-xs tabular-nums text-slate-400">
                                  {s.marksObtained}/{s.maxMarks}
                                </span>
                              </>
                            )}
                          </Td>
                        ))}
                        <Td
                          className={cx(
                            'text-right font-medium tabular-nums',
                            TONE_TEXT[tone(row.percentage, passMark)]
                          )}
                        >
                          {row.percentage === null ? '—' : `${row.percentage}%`}
                        </Td>
                        <Td className="text-right font-semibold tabular-nums text-slate-900">
                          {row.sgpa ?? '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Marks come from assignments that have been graded <strong>and released</strong>. To
              add a result, grade the work on the{' '}
              <Link
                to={isAdmin ? '/admin/assignments' : '/teacher/assignments'}
                className="text-brand-600 hover:underline"
              >
                assignments page
              </Link>{' '}
              and click <strong>Release results</strong>.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone: t }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', t ? TONE_TEXT[t] : 'text-slate-900')}>
        {value}
      </p>
    </div>
  );
}
