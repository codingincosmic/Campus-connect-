/**
 * Admin → All assignments
 *
 * Every assignment in the college, from every teacher, with the target
 * class+section shown prominently.
 *
 * That last part matters: two subjects can share a name across sections
 * (e.g. "Data Structures" in Section A and Section B), so "who can actually
 * see this assignment?" is the question this page is built to answer.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { readLoadError } from '../../lib/formError.js';
import { PageHeader } from '../../components/AppLayout.jsx';
import { FileLink, dueLabel, formatDateTime } from '../../components/AssignmentViews.jsx';
import {
  Alert,
  Badge,
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

export function AdminAssignmentsPage() {
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');

  // Admins get every assignment from this endpoint; teachers get only theirs.
  const assignments = useAsyncData(() => api.get('/assignments'), []);
  const classes = useAsyncData(() => api.get('/classes'), []);

  const items = assignments.data?.items ?? [];
  const classList = classes.data?.items ?? [];

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((a) => {
      if (classId && a.subject.class.id !== classId) return false;
      if (!term) return true;
      return `${a.title} ${a.subject.name} ${a.createdBy.name}`.toLowerCase().includes(term);
    });
  }, [items, classId, search]);

  return (
    <>
      <PageHeader
        title="All assignments"
        subtitle="Every assignment set across the college, and exactly which class sees it"
      />

      {assignments.error && (
        <Alert tone="error" className="mb-4">
          {readLoadError(assignments.error)}
        </Alert>
      )}

      <Alert tone="info" className="mb-4">
        An assignment is visible only to students enrolled in the <strong>class and section</strong>{' '}
        of its subject. The same subject name can exist in several sections, each with its own
        teacher — check the <strong>Visible to</strong> column if something appears to be missing
        from a student&apos;s portal.
      </Alert>

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Class"
            name="classId"
            placeholder="All classes"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            options={classList.map((c) => ({
              value: c.id,
              label: `${c.name} — Section ${c.section} (${c.academicYear})`,
            }))}
          />
          <Field
            label="Search"
            name="search"
            type="search"
            placeholder="Title, subject or teacher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card
        title={`${visible.length} assignment${visible.length === 1 ? '' : 's'}`}
        subtitle="Newest due date first"
      >
        {assignments.loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Spinner className="h-7 w-7" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title={items.length === 0 ? 'No assignments set yet' : 'No matching assignments'}>
            {items.length === 0 && 'Assignments appear here as soon as a teacher creates one.'}
          </EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[58rem] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Assignment</Th>
                  <Th>Set by</Th>
                  <Th>Subject</Th>
                  <Th>Visible to</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Progress</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((a) => {
                  const due = dueLabel(a.dueDate);
                  const pct = a.classSize > 0 ? Math.round((a.submissionCount / a.classSize) * 100) : 0;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-medium text-slate-900">{a.title}</span>
                        <span className="block text-xs text-slate-500">
                          {a.maxMarks} marks
                          {a.publishedCount > 0 && ' · results released'}
                        </span>
                        {a.hasFile && (
                          <span className="mt-1 inline-block">
                            <FileLink url={a.fileDownloadUrl} name={a.fileName} />
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-slate-600">{a.createdBy.name}</Td>
                      <Td className="text-slate-600">{a.subject.name}</Td>
                      <Td>
                        {/* The answer to "why can't my student see this?" */}
                        <Badge tone="brand">
                          {a.subject.class.name} — Section {a.subject.class.section}
                        </Badge>
                        <span className="mt-1 block text-xs text-slate-500">
                          {a.classSize} student{a.classSize === 1 ? '' : 's'} enrolled
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="text-sm text-slate-700">{formatDateTime(a.dueDate)}</span>
                        <span
                          className={cx(
                            'block text-xs',
                            due.overdue ? 'text-slate-400' : 'text-brand-600'
                          )}
                        >
                          {due.text}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-20 rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-brand-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-xs tabular-nums text-slate-500">
                            {a.submissionCount}/{a.classSize}
                          </span>
                        </div>
                        <span className="mt-1 block text-xs text-slate-400">
                          {a.gradedCount} graded
                          {a.lateCount > 0 && ` · ${a.lateCount} late`}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <Link
                          to={`/teacher/assignments/${a.id}`}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          Submissions
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
