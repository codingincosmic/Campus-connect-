/**
 * ---------------------------------------------------------------------------
 * ADMIN OVERSIGHT — what the teaching staff have actually been doing.
 * ---------------------------------------------------------------------------
 *
 * This module is read-only and admin-only. It answers two questions:
 *
 *   1. "How active is each teacher?"  -> teacherSummary()
 *   2. "What happened recently?"      -> activityFeed()
 *
 * Everything is derived from records the other modules already write
 * (assignments, attendance, grading), so there is no separate audit table to
 * keep in sync — the activity IS the data.
 */
import { prisma } from '../../lib/prisma.js';
import { formatDateOnly } from '../../lib/dates.js';

/* ========================================================================== */
/* Per-teacher summary                                                        */
/* ========================================================================== */

/**
 * One row per teacher, with counts of the work they've done.
 *
 * Attendance is reported as SESSIONS (one subject, one date, one period) rather
 * than raw records, because "marked 240 records" is meaningless next to
 * "took the register 30 times".
 */
export async function teacherSummary() {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      isActive: true,
      taughtSubjects: {
        select: {
          id: true,
          name: true,
          credits: true,
          class: { select: { id: true, name: true, section: true, academicYear: true } },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const teacherIds = teachers.map((t) => t.id);
  if (teacherIds.length === 0) return [];

  const [assignmentAgg, gradedAgg, attendanceRows, editAgg] = await Promise.all([
    prisma.assignment.groupBy({
      by: ['createdById'],
      where: { createdById: { in: teacherIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.submission.groupBy({
      by: ['gradedById'],
      where: { gradedById: { in: teacherIds } },
      _count: { _all: true },
      _max: { gradedAt: true },
    }),
    // Session granularity: one row per (teacher, subject, date, period).
    prisma.attendanceRecord.groupBy({
      by: ['markedById', 'subjectId', 'date', 'periodNo'],
      where: { markedById: { in: teacherIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['markedById'],
      where: { markedById: { in: teacherIds }, editedAt: { not: null } },
      _count: { _all: true },
      _max: { editedAt: true },
    }),
  ]);

  const byId = (rows, key) => new Map(rows.map((r) => [r[key], r]));
  const assignments = byId(assignmentAgg, 'createdById');
  const graded = byId(gradedAgg, 'gradedById');
  const edits = byId(editAgg, 'markedById');

  // Collapse the session rows down to per-teacher totals.
  const sessions = new Map();
  for (const row of attendanceRows) {
    const current = sessions.get(row.markedById) ?? { sessions: 0, records: 0, last: null };
    current.sessions += 1;
    current.records += row._count._all;
    if (!current.last || row._max.createdAt > current.last) current.last = row._max.createdAt;
    sessions.set(row.markedById, current);
  }

  return teachers.map((teacher) => {
    const a = assignments.get(teacher.id);
    const g = graded.get(teacher.id);
    const s = sessions.get(teacher.id);
    const e = edits.get(teacher.id);

    // Most recent sign of life, across every kind of activity.
    const lastActiveAt = latest([a?._max.createdAt, g?._max.gradedAt, s?.last, e?._max.editedAt]);

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      username: teacher.username,
      isActive: teacher.isActive,
      subjects: teacher.taughtSubjects,
      classes: uniqueClasses(teacher.taughtSubjects),
      stats: {
        subjects: teacher.taughtSubjects.length,
        assignmentsCreated: a?._count._all ?? 0,
        attendanceSessions: s?.sessions ?? 0,
        attendanceRecords: s?.records ?? 0,
        attendanceEdits: e?._count._all ?? 0,
        submissionsGraded: g?._count._all ?? 0,
      },
      lastActiveAt,
    };
  });
}

/** Distinct class+section rows a teacher touches, derived from their subjects. */
function uniqueClasses(subjects) {
  const map = new Map();
  for (const subject of subjects) {
    if (!map.has(subject.class.id)) map.set(subject.class.id, subject.class);
  }
  return [...map.values()];
}

function latest(dates) {
  const valid = dates.filter(Boolean).map((d) => new Date(d));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

/* ========================================================================== */
/* Activity feed                                                              */
/* ========================================================================== */

/**
 * A merged, reverse-chronological feed of staff activity.
 *
 * Each source is queried with its own limit and then merged in memory. That's
 * simpler and quite fast enough here; if the college grows to the point where
 * this feels slow, the fix is a dedicated `activity_log` table written to by
 * each module.
 *
 * @param {{ limit?: number, teacherId?: string, type?: string }} options
 */
export async function activityFeed({ limit = 50, teacherId, type } = {}) {
  const teacherFilter = teacherId ? { in: [teacherId] } : undefined;
  const wants = (kind) => !type || type === 'ALL' || type === kind;

  // Over-fetch each source so the merged list still has `limit` good rows.
  const perSource = Math.min(limit * 2, 200);

  const [assignments, attendanceSessions, attendanceEdits, gradings] = await Promise.all([
    wants('ASSIGNMENT_CREATED')
      ? prisma.assignment.findMany({
          where: teacherFilter ? { createdById: teacherFilter } : {},
          select: {
            id: true,
            title: true,
            createdAt: true,
            maxMarks: true,
            dueDate: true,
            createdBy: { select: { id: true, name: true } },
            subject: {
              select: { id: true, name: true, class: { select: { name: true, section: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: perSource,
        })
      : [],

    wants('ATTENDANCE_MARKED')
      ? prisma.attendanceRecord.groupBy({
          by: ['markedById', 'subjectId', 'date', 'periodNo'],
          where: teacherFilter ? { markedById: teacherFilter } : {},
          _count: { _all: true },
          _max: { createdAt: true },
          orderBy: { _max: { createdAt: 'desc' } },
          take: perSource,
        })
      : [],

    wants('ATTENDANCE_EDITED')
      ? prisma.attendanceRecord.findMany({
          where: {
            editedAt: { not: null },
            ...(teacherFilter ? { markedById: teacherFilter } : {}),
          },
          select: {
            id: true,
            date: true,
            periodNo: true,
            status: true,
            editedAt: true,
            editReason: true,
            markedBy: { select: { id: true, name: true } },
            student: { select: { id: true, name: true, rollNo: true } },
            subject: {
              select: { id: true, name: true, class: { select: { name: true, section: true } } },
            },
          },
          orderBy: { editedAt: 'desc' },
          take: perSource,
        })
      : [],

    wants('SUBMISSION_GRADED')
      ? prisma.submission.findMany({
          where: {
            gradedAt: { not: null },
            ...(teacherFilter ? { gradedById: teacherFilter } : {}),
          },
          select: {
            id: true,
            marksObtained: true,
            gradedAt: true,
            isPublished: true,
            gradedBy: { select: { id: true, name: true } },
            student: { select: { id: true, name: true, rollNo: true } },
            assignment: {
              select: {
                id: true,
                title: true,
                maxMarks: true,
                subject: {
                  select: { name: true, class: { select: { name: true, section: true } } },
                },
              },
            },
          },
          orderBy: { gradedAt: 'desc' },
          take: perSource,
        })
      : [],
  ]);

  // --- Normalise every source into one shape ------------------------------
  const events = [];

  for (const a of assignments) {
    events.push({
      type: 'ASSIGNMENT_CREATED',
      at: a.createdAt,
      teacher: a.createdBy,
      subject: a.subject.name,
      className: `${a.subject.class.name} — Section ${a.subject.class.section}`,
      summary: `Created assignment "${a.title}"`,
      detail: `Out of ${a.maxMarks} marks, due ${a.dueDate.toISOString().slice(0, 10)}`,
      link: `/admin/assignments`,
    });
  }

  // groupBy can't include relations, so resolve the subject names in one query.
  if (attendanceSessions.length > 0) {
    const subjectIds = [...new Set(attendanceSessions.map((s) => s.subjectId))];
    const teacherIds = [...new Set(attendanceSessions.map((s) => s.markedById))];

    const [subjects, teachers] = await Promise.all([
      prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true, class: { select: { name: true, section: true } } },
      }),
      prisma.user.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, name: true },
      }),
    ]);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    for (const session of attendanceSessions) {
      const subject = subjectMap.get(session.subjectId);
      if (!subject) continue;
      events.push({
        type: 'ATTENDANCE_MARKED',
        at: session._max.createdAt,
        teacher: teacherMap.get(session.markedById) ?? { id: session.markedById, name: 'Unknown' },
        subject: subject.name,
        className: `${subject.class.name} — Section ${subject.class.section}`,
        summary: `Marked attendance for ${session._count._all} student(s)`,
        detail: `${formatDateOnly(session.date)}, period ${session.periodNo}`,
        link: `/admin/oversight`,
      });
    }
  }

  for (const edit of attendanceEdits) {
    events.push({
      type: 'ATTENDANCE_EDITED',
      at: edit.editedAt,
      teacher: edit.markedBy,
      subject: edit.subject.name,
      className: `${edit.subject.class.name} — Section ${edit.subject.class.section}`,
      summary: `Changed ${edit.student.name}'s attendance to ${edit.status.toLowerCase()}`,
      // The reason is the whole point of this event for oversight.
      detail: edit.editReason
        ? `Reason: ${edit.editReason}`
        : 'No reason recorded',
      highlight: true,
      link: `/admin/oversight`,
    });
  }

  for (const g of gradings) {
    events.push({
      type: 'SUBMISSION_GRADED',
      at: g.gradedAt,
      teacher: g.gradedBy ?? { id: null, name: 'Unknown' },
      subject: g.assignment.subject.name,
      className: `${g.assignment.subject.class.name} — Section ${g.assignment.subject.class.section}`,
      summary: `Graded ${g.student.name} — ${g.marksObtained}/${g.assignment.maxMarks}`,
      detail: `"${g.assignment.title}" · ${g.isPublished ? 'released to marksheet' : 'not yet released'}`,
      link: `/teacher/assignments/${g.assignment.id}`,
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { items: events.slice(0, limit), total: events.length };
}

/* ========================================================================== */
/* College-wide overview                                                      */
/* ========================================================================== */

/** Headline numbers for the oversight dashboard. */
export async function overviewStats() {
  const [teachers, students, classes, subjects, assignments, submissions, unassigned, ungraded] =
    await Promise.all([
      prisma.user.count({ where: { role: 'TEACHER', isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.assignment.count(),
      prisma.submission.count(),
      // Subjects with nobody assigned to teach them — a real gap to chase.
      prisma.subject.count({ where: { teacherId: null } }),
      // Work handed in but not yet marked.
      prisma.submission.count({ where: { marksObtained: null } }),
    ]);

  return {
    teachers,
    students,
    classes,
    subjects,
    assignments,
    submissions,
    unassignedSubjects: unassigned,
    ungradedSubmissions: ungraded,
  };
}
