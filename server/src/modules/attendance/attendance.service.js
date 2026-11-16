/**
 * ---------------------------------------------------------------------------
 * ATTENDANCE — business logic.
 * ---------------------------------------------------------------------------
 *
 * Two rules matter most here:
 *
 *   1. Marking is idempotent. Saving the same sheet twice changes nothing;
 *      saving a changed sheet records WHO changed it, WHEN and WHY.
 *
 *   2. History is protected. A teacher may correct a mistake for the last
 *      N days (ATTENDANCE_EDIT_WINDOW_DAYS, default 7) and must give a reason.
 *      Older records are read-only.
 */
import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { summarise, summariseCounts, STATUS_META } from '../../config/attendance.js';
import {
  assertCanTeachSubject,
  assertCanViewStudent,
  assertCanViewClass,
} from '../../lib/access.js';
import { formatDateOnly, todayDateOnly, daysBetween, monthKey } from '../../lib/dates.js';

/* ========================================================================== */
/* Marking                                                                    */
/* ========================================================================== */

/**
 * The marking sheet: every enrolled student, with whatever has already been
 * saved for this subject/date/period.
 */
export async function getSheet(user, { subjectId, date, periodNo }) {
  const subject = await assertCanTeachSubject(user, subjectId);

  const [enrollments, existing] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: subject.class.id },
      select: {
        student: { select: { id: true, name: true, rollNo: true, isActive: true } },
      },
      orderBy: { student: { rollNo: 'asc' } },
    }),
    prisma.attendanceRecord.findMany({
      where: { subjectId, date, periodNo },
      select: {
        id: true,
        studentId: true,
        status: true,
        editedAt: true,
        editReason: true,
        createdAt: true,
        markedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const byStudent = new Map(existing.map((record) => [record.studentId, record]));

  const students = enrollments.map(({ student }) => {
    const record = byStudent.get(student.id);
    return {
      ...student,
      status: record?.status ?? null,
      recordId: record?.id ?? null,
      editedAt: record?.editedAt ?? null,
      editReason: record?.editReason ?? null,
      markedBy: record?.markedBy ?? null,
    };
  });

  const window = editWindowFor(date);

  return {
    subject,
    date: formatDateOnly(date),
    periodNo,
    students,
    alreadyMarked: existing.length > 0,
    /** Tells the UI up front whether saving will be accepted at all. */
    editable: window.canWrite,
    editWindow: window,
  };
}

/**
 * Save a whole sheet. Creates records that don't exist and updates those that
 * changed; untouched rows are left alone so their original timestamps survive.
 */
export async function markAttendance(user, { subjectId, date, periodNo, records, editReason }) {
  const subject = await assertCanTeachSubject(user, subjectId);

  const window = editWindowFor(date);
  if (window.isFuture) {
    throw badRequest('You cannot mark attendance for a date in the future.');
  }

  // Every student must actually be enrolled in this subject's class.
  const enrolled = await prisma.enrollment.findMany({
    where: { classId: subject.class.id, studentId: { in: records.map((r) => r.studentId) } },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  const strangers = records.filter((r) => !enrolledIds.has(r.studentId));
  if (strangers.length > 0) {
    throw badRequest(
      `${strangers.length} of the students you submitted are not enrolled in ${subject.name}.`
    );
  }

  const existing = await prisma.attendanceRecord.findMany({
    where: { subjectId, date, periodNo, studentId: { in: [...enrolledIds] } },
    select: { id: true, studentId: true, status: true },
  });
  const existingByStudent = new Map(existing.map((r) => [r.studentId, r]));

  // Split the submission into three buckets so we only write what changed.
  const toCreate = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const record of records) {
    const current = existingByStudent.get(record.studentId);
    if (!current) toCreate.push(record);
    else if (current.status !== record.status) toUpdate.push({ ...record, id: current.id });
    else unchanged += 1;
  }

  // Changing history needs both a reason and a date inside the edit window.
  if (toUpdate.length > 0) {
    if (!window.canEdit) {
      throw forbidden(
        `Attendance can only be changed within ${env.attendanceEditWindowDays} days. ` +
          `This date is ${window.ageInDays} days old.`
      );
    }
    if (!editReason) {
      throw badRequest('Give a reason for changing attendance that was already saved.', {
        fieldErrors: { editReason: 'A reason is required when changing saved attendance.' },
      });
    }
  }

  const now = new Date();

  // One transaction: either the whole sheet saves, or none of it does.
  await prisma.$transaction([
    ...(toCreate.length > 0
      ? [
          prisma.attendanceRecord.createMany({
            data: toCreate.map((r) => ({
              studentId: r.studentId,
              subjectId,
              date,
              periodNo,
              status: r.status,
              markedById: user.id,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...toUpdate.map((r) =>
      prisma.attendanceRecord.update({
        where: { id: r.id },
        data: {
          status: r.status,
          markedById: user.id,
          editedAt: now,
          editReason,
        },
      })
    ),
  ]);

  return {
    created: toCreate.length,
    updated: toUpdate.length,
    unchanged,
    date: formatDateOnly(date),
    periodNo,
  };
}

/**
 * How old a date is, and therefore what may be done to it.
 * Kept in one place so the API and the UI can't disagree about the rules.
 */
function editWindowFor(date) {
  const today = todayDateOnly();
  const ageInDays = daysBetween(date, today);

  return {
    ageInDays,
    isFuture: ageInDays < 0,
    windowDays: env.attendanceEditWindowDays,
    /** New records may be added for today or any past date. */
    canWrite: ageInDays >= 0,
    /** Existing records may only be corrected inside the window. */
    canEdit: ageInDays >= 0 && ageInDays <= env.attendanceEditWindowDays,
  };
}

/* ========================================================================== */
/* Viewing — one student                                                      */
/* ========================================================================== */

/**
 * A student's complete attendance picture:
 *   overall %, per-subject %, per-month %, and the raw day-by-day list.
 */
export async function getStudentAttendance(user, studentId, { from, to, subjectId }) {
  const student = await assertCanViewStudent(user, studentId);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      ...(subjectId ? { subjectId } : {}),
      ...dateRangeWhere(from, to),
    },
    select: {
      id: true,
      date: true,
      periodNo: true,
      status: true,
      editedAt: true,
      editReason: true,
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          credits: true,
          class: { select: { id: true, name: true, section: true } },
        },
      },
    },
    orderBy: [{ date: 'desc' }, { periodNo: 'desc' }],
  });

  // --- Per subject ---
  const subjectGroups = new Map();
  for (const record of records) {
    const key = record.subject.id;
    if (!subjectGroups.has(key)) subjectGroups.set(key, { subject: record.subject, records: [] });
    subjectGroups.get(key).records.push(record);
  }

  const bySubject = [...subjectGroups.values()]
    .map(({ subject, records: subjectRecords }) => ({
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      credits: subject.credits,
      className: `${subject.class.name} ${subject.class.section}`,
      ...summarise(subjectRecords),
      isDefaulter: isDefaulter(summarise(subjectRecords).percentage),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Per month (oldest first, so a chart reads left to right) ---
  const monthGroups = new Map();
  for (const record of records) {
    const key = monthKey(record.date);
    if (!monthGroups.has(key)) monthGroups.set(key, []);
    monthGroups.get(key).push(record);
  }

  const byMonth = [...monthGroups.entries()]
    .map(([month, monthRecords]) => ({ month, ...summarise(monthRecords) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const overall = summarise(records);

  return {
    student,
    overall: { ...overall, isDefaulter: isDefaulter(overall.percentage) },
    bySubject,
    byMonth,
    // Day-by-day list; the UI paginates this client-side.
    records: records.map((r) => ({
      id: r.id,
      date: formatDateOnly(r.date),
      periodNo: r.periodNo,
      status: r.status,
      subjectId: r.subject.id,
      subjectName: r.subject.name,
      edited: Boolean(r.editedAt),
      editReason: r.editReason,
    })),
    threshold: env.attendanceThreshold,
  };
}

/* ========================================================================== */
/* Viewing — reports                                                          */
/* ========================================================================== */

/**
 * Per-student attendance stats across a subject or a whole class.
 * Powers both the teacher's report table and the CSV export.
 */
export async function getReport(user, { subjectId, classId, from, to }) {
  const scope = await resolveReportScope(user, { subjectId, classId });

  const [enrollments, grouped] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: scope.classId },
      select: { student: { select: { id: true, name: true, rollNo: true, email: true } } },
      orderBy: { student: { rollNo: 'asc' } },
    }),
    // groupBy does the counting in the database rather than pulling every row.
    prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: {
        ...(subjectId ? { subjectId } : { subject: { classId: scope.classId } }),
        ...dateRangeWhere(from, to),
      },
      _count: { _all: true },
    }),
  ]);

  /** studentId -> { PRESENT: n, ABSENT: n, ... } */
  const counts = new Map();
  for (const row of grouped) {
    if (!counts.has(row.studentId)) counts.set(row.studentId, {});
    counts.get(row.studentId)[row.status] = row._count._all;
  }

  const rows = enrollments.map(({ student }) => {
    const stats = summariseCounts(counts.get(student.id) ?? {});
    return {
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo,
      email: student.email,
      ...stats,
      isDefaulter: isDefaulter(stats.percentage),
    };
  });

  // Class-level summary: the average of students who have any counted records.
  const withData = rows.filter((r) => r.percentage !== null);
  const classAverage =
    withData.length === 0
      ? null
      : Math.round(
          (withData.reduce((sum, r) => sum + r.percentage, 0) / withData.length) * 100
        ) / 100;

  return {
    scope,
    from: from ? formatDateOnly(from) : null,
    to: to ? formatDateOnly(to) : null,
    threshold: env.attendanceThreshold,
    classAverage,
    defaulterCount: rows.filter((r) => r.isDefaulter).length,
    rows,
  };
}

/** Students below the attendance threshold — the "defaulters list". */
export async function getDefaulters(user, { classId, subjectId, from, to, threshold }) {
  const report = await getReport(user, { subjectId, classId, from, to });
  const limit = threshold ?? env.attendanceThreshold;

  return {
    ...report,
    threshold: limit,
    // A student with no records yet isn't a defaulter, they're just unmarked.
    rows: report.rows.filter((r) => r.percentage !== null && r.percentage < limit),
  };
}

/**
 * Work out which class a report covers, and check the user may see it.
 * Accepts either a subject (report on one subject) or a class (all subjects).
 */
async function resolveReportScope(user, { subjectId, classId }) {
  if (subjectId) {
    const subject = await assertCanTeachSubject(user, subjectId);
    return {
      type: 'subject',
      subjectId: subject.id,
      subjectName: subject.name,
      classId: subject.class.id,
      className: `${subject.class.name} — Section ${subject.class.section}`,
      academicYear: subject.class.academicYear,
    };
  }

  const klass = await assertCanViewClass(user, classId);
  return {
    type: 'class',
    subjectId: null,
    subjectName: null,
    classId: klass.id,
    className: `${klass.name} — Section ${klass.section}`,
    academicYear: klass.academicYear,
  };
}

/* ========================================================================== */
/* CSV export                                                                 */
/* ========================================================================== */

/**
 * Render a report as CSV.
 *
 * Note the leading apostrophe guard in `csvCell`: a value starting with =, +,
 * - or @ is treated as a formula by Excel, which is a well-known injection
 * vector when the value came from user input (a student's name, say).
 */
export function reportToCsv(report) {
  const header = [
    'Roll No',
    'Name',
    'Email',
    'Present',
    'Absent',
    'Late',
    'Excused',
    'Counted',
    'Attended',
    'Attendance %',
    'Status',
  ];

  const lines = [
    // A short title block makes the file self-explanatory once downloaded.
    csvRow([`Attendance report — ${report.scope.className}`]),
    csvRow([
      report.scope.type === 'subject' ? `Subject: ${report.scope.subjectName}` : 'All subjects',
      `Period: ${report.from ?? 'start'} to ${report.to ?? 'today'}`,
      `Threshold: ${report.threshold}%`,
    ]),
    '',
    csvRow(header),
    ...report.rows.map((row) =>
      csvRow([
        row.rollNo ?? '',
        row.name,
        row.email,
        row.breakdown.PRESENT,
        row.breakdown.ABSENT,
        row.breakdown.LATE,
        row.breakdown.EXCUSED,
        row.counted,
        row.attended,
        row.percentage === null ? '' : row.percentage,
        row.percentage === null ? 'No records' : row.isDefaulter ? 'DEFAULTER' : 'OK',
      ])
    ),
    '',
    csvRow(['Class average', report.classAverage ?? '']),
    csvRow(['Defaulters', report.defaulterCount]),
  ];

  // CRLF and a UTF-8 BOM so Excel on Windows opens it correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);

  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  // Quote if the value contains a comma, quote or newline.
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Suggested download filename, e.g. attendance-bca-year-2-a-2026-08-15.csv */
export function csvFilename(report) {
  const slug = report.scope.className
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Stamp with the college's local date, matching what the user sees on screen.
  return `attendance-${slug}-${formatDateOnly(todayDateOnly())}.csv`;
}

/* ========================================================================== */
/* Small helpers                                                              */
/* ========================================================================== */

/** Prisma `where` fragment for an optional date range. */
function dateRangeWhere(from, to) {
  if (!from && !to) return {};
  return { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}

/** Below the college threshold. Null (no records yet) is not a defaulter. */
function isDefaulter(percentage) {
  return percentage !== null && percentage < env.attendanceThreshold;
}

/** Re-exported so the routes layer can expose it via /api/config. */
export { STATUS_META };

/** Guard used by the controller before touching a single record by id. */
export async function getRecordForEdit(user, recordId) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    select: { id: true, subjectId: true, date: true, status: true, periodNo: true, studentId: true },
  });
  if (!record) throw notFound('That attendance record does not exist.');

  await assertCanTeachSubject(user, record.subjectId);
  return record;
}
