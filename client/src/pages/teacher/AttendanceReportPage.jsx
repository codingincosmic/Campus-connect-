/**
 * Teacher → Attendance reports
 *
 * Per-student attendance across one subject or a whole class, with a
 * defaulters filter and a CSV download.
 */
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import {
  formatPercent,
  percentTone,
  ProgressBar,
  STATUS_LABEL,
} from '../../components/AttendanceViews.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
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

export function AttendanceReportPage() {
  const { context } = useAuth();
  const subjects = context.subjects ?? [];

  /** '' means "all subjects in this class"; otherwise a specific subject id. */
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyDefaulters, setOnlyDefaulters] = useState(false);

  const query = new URLSearchParams();
  if (subjectId) query.set('subjectId', subjectId);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const queryString = query.toString();

  const { data, loading, error } = useAsyncData(
    () => (subjectId ? api.get(`/attendance/report?${queryString}`) : Promise.resolve(null)),
    [queryString, subjectId]
  );

  const rows = data?.rows ?? [];
  const visible = onlyDefaulters ? rows.filter((r) => r.isDefaulter) : rows;

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader title="Attendance reports" />
        <Card>
          <EmptyState title="You have no subjects assigned">
            Reports appear once an administrator assigns you to a subject.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance reports"
        subtitle="Percentages, defaulters and a CSV export"
        action={
          data && (
            /* A plain link, not fetch(): the browser handles the download and
               sends the auth cookie automatically. */
            <a
              href={`/api/attendance/report.csv?${queryString}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Download CSV
            </a>
          )
        }
      />

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
            label="From"
            name="from"
            type="date"
            hint="Optional"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Field
            label="To"
            name="to"
            type="date"
            hint="Optional"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      {error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(error)}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data ? null : (
        <>
          {/* --- Headline figures --- */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Students" value={data.rows.length} />
            <Stat
              label="Class average"
              value={formatPercent(data.classAverage)}
              tone={percentTone(data.classAverage, data.threshold)}
            />
            <Stat
              label="Defaulters"
              value={data.defaulterCount}
              tone={data.defaulterCount > 0 ? 'rose' : 'green'}
            />
            <Stat label="Threshold" value={`${data.threshold}%`} />
          </div>

          <Card
            title={data.scope.subjectName ?? data.scope.className}
            subtitle={`${data.scope.className} · ${data.from ?? 'start'} to ${data.to ?? 'today'}`}
            action={
              <Button
                variant={onlyDefaulters ? 'primary' : 'secondary'}
                className="min-h-9 px-3 py-1.5"
                onClick={() => setOnlyDefaulters((v) => !v)}
              >
                {onlyDefaulters ? 'Showing defaulters' : 'Defaulters only'}
              </Button>
            }
          >
            {visible.length === 0 ? (
              <EmptyState title={onlyDefaulters ? 'No defaulters' : 'No students in this class'}>
                {onlyDefaulters && `Everyone is at or above ${data.threshold}%.`}
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>Roll no.</Th>
                      <Th>Name</Th>
                      <Th className="text-right">P</Th>
                      <Th className="text-right">A</Th>
                      <Th className="text-right">L</Th>
                      <Th className="text-right">E</Th>
                      <Th className="text-right">Attended</Th>
                      <Th className="w-40">Attendance</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((row) => {
                      const tone = percentTone(row.percentage, data.threshold);
                      return (
                        <tr
                          key={row.studentId}
                          className={cx('hover:bg-slate-50', row.isDefaulter && 'bg-rose-50/60')}
                        >
                          <Td className="whitespace-nowrap tabular-nums font-medium">
                            {row.rollNo || '—'}
                          </Td>
                          <Td>
                            {row.name}
                            {row.isDefaulter && (
                              <Badge tone="rose" className="ml-2">
                                Defaulter
                              </Badge>
                            )}
                          </Td>
                          <Td className="text-right tabular-nums">{row.breakdown.PRESENT}</Td>
                          <Td className="text-right tabular-nums">{row.breakdown.ABSENT}</Td>
                          <Td className="text-right tabular-nums">{row.breakdown.LATE}</Td>
                          <Td className="text-right tabular-nums">{row.breakdown.EXCUSED}</Td>
                          <Td className="whitespace-nowrap text-right tabular-nums text-slate-500">
                            {row.attended}/{row.counted}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span
                                className={cx(
                                  'w-14 shrink-0 text-right text-sm font-semibold tabular-nums',
                                  TONE_TEXT[tone]
                                )}
                              >
                                {formatPercent(row.percentage)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <ProgressBar
                                  value={row.percentage}
                                  threshold={data.threshold}
                                  tone={tone}
                                />
                              </div>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}

            <p className="mt-3 text-xs text-slate-500">
              P = {STATUS_LABEL.PRESENT}, A = {STATUS_LABEL.ABSENT}, L = {STATUS_LABEL.LATE}, E ={' '}
              {STATUS_LABEL.EXCUSED}. Late counts as attended; excused is left out of the total.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone = 'slate' }) {
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
