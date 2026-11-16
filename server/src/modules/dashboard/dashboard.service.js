/**
 * ---------------------------------------------------------------------------
 * DASHBOARDS — one aggregated payload per role.
 * ---------------------------------------------------------------------------
 *
 * Each role's landing page needs several unrelated figures (attendance,
 * assignments, notices, results). Fetching them as one endpoint rather than
 * five keeps the first paint fast, especially on a phone.
 *
 * Nothing new is computed here: the rules live in the feature modules and
 * config, and this module only assembles the answers.
 */
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { summariseCounts } from '../../config/attendance.js';
import { todayDateOnly, formatDateOnly } from '../../lib/dates.js';
import { assertCanViewStudent } from '../../lib/access.js';
import { getStudentResults } from '../results/results.service.js';

/** Only released marks are ever visible outside the grading screen. */
const RELEASED = { isPublished: true, marksObtained: { not: null } };

/** How far ahead "upcoming" reaches. */
const UPCOMING_DAYS = 7;

/* ========================================================================== */
/* Teacher                                                                    */
/* ========================================================================== */

export async function teacherDashboard(user) {
  const today = todayDateOnly();

  const subjects = await prisma.subject.findMany({
    where: { teacherId: user.id },
    select: {
      id: true,
      name: true,
      code: true,
      credits: true,
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
          semester: true,
          _count: { select: { enrollments: true } },
        },
      },
    },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
  });

  const subjectIds = subjects.map((s) => s.id);

  if (subjectIds.length === 0) {
    return { subjects: [], today: formatDateOnly(today), toGrade: [], counts: emptyTeacherCounts() };
  }

  const [markedToday, ungraded, upcoming, myNotices, attendanceCounts] = await Promise.all([
    // Which of today's registers are already done.
    prisma.attendanceRecord.groupBy({
      by: ['subjectId', 'periodNo'],
      where: { subjectId: { in: subjectIds }, date: today },
      _count: { _all: true },
    }),

    // Work handed in but not yet marked — the teacher's actual to-do list.
    prisma.submission.findMany({
      where: { marksObtained: null, assignment: { subjectId: { in: subjectIds } } },
      select: {
        id: true,
        submittedAt: true,
        isLate: true,
        student: { select: { id: true, name: true, rollNo: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            maxMarks: true,
            subject: { select: { id: true, name: true, class: { select: { name: true, section: true } } } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
      take: 8,
    }),

    // Deadlines coming up in their subjects.
    prisma.assignment.findMany({
      where: {
        subjectId: { in: subjectIds },
        dueDate: { gte: new Date(), lte: addDays(new Date(), UPCOMING_DAYS) },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        maxMarks: true,
        subject: { select: { name: true, class: { select: { name: true, section: true } } } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    }),

    prisma.notice.findMany({
      where: { postedById: user.id },
      select: { id: true, title: true, createdAt: true, targetType: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // For the defaulters figure across everything they teach.
    prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { subjectId: { in: subjectIds } },
      _count: { _all: true },
    }),
  ]);

  /** subjectId -> periods marked today */
  const markedBySubject = new Map();
  for (const row of markedToday) {
    const list = markedBySubject.get(row.subjectId) ?? [];
    list.push({ periodNo: row.periodNo, students: row._count._all });
    markedBySubject.set(row.subjectId, list);
  }

  // Defaulters: students below the threshold across this teacher's subjects.
  const perStudent = new Map();
  for (const row of attendanceCounts) {
    const current = perStudent.get(row.studentId) ?? {};
    current[row.status] = row._count._all;
    perStudent.set(row.studentId, current);
  }
  let defaulters = 0;
  for (const counts of perStudent.values()) {
    const { percentage } = summariseCounts(counts);
    if (percentage !== null && percentage < env.attendanceThreshold) defaulters += 1;
  }

  return {
    today: formatDateOnly(today),
    threshold: env.attendanceThreshold,
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      credits: s.credits,
      className: `${s.class.name} — Section ${s.class.section}`,
      classId: s.class.id,
      studentCount: s.class._count.enrollments,
      // Drives the "take the register" prompt.
      markedToday: markedBySubject.get(s.id) ?? [],
      isMarkedToday: (markedBySubject.get(s.id) ?? []).length > 0,
    })),
    toGrade: ungraded.map((s) => ({
      submissionId: s.id,
      assignmentId: s.assignment.id,
      assignmentTitle: s.assignment.title,
      maxMarks: s.assignment.maxMarks,
      subjectName: s.assignment.subject.name,
      className: `${s.assignment.subject.class.name} ${s.assignment.subject.class.section}`,
      studentName: s.student.name,
      rollNo: s.student.rollNo,
      submittedAt: s.submittedAt,
      isLate: s.isLate,
    })),
    upcoming: upcoming.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      maxMarks: a.maxMarks,
      subjectName: a.subject.name,
      className: `${a.subject.class.name} ${a.subject.class.section}`,
      submissionCount: a._count.submissions,
    })),
    recentNotices: myNotices,
    counts: {
      subjects: subjects.length,
      classes: new Set(subjects.map((s) => s.class.id)).size,
      students: new Set(subjects.map((s) => s.class.id)).size > 0
        ? subjects.reduce((acc, s) => {
            // Count each class's students once, not once per subject.
            if (!acc.seen.has(s.class.id)) {
              acc.seen.add(s.class.id);
              acc.total += s.class._count.enrollments;
            }
            return acc;
          }, { seen: new Set(), total: 0 }).total
        : 0,
      registersDueToday: subjects.filter((s) => (markedBySubject.get(s.id) ?? []).length === 0).length,
      awaitingGrading: await prisma.submission.count({
        where: { marksObtained: null, assignment: { subjectId: { in: subjectIds } } },
      }),
      defaulters,
    },
  };
}

function emptyTeacherCounts() {
  return {
    subjects: 0,
    classes: 0,
    students: 0,
    registersDueToday: 0,
    awaitingGrading: 0,
    defaulters: 0,
  };
}

/* ========================================================================== */
/* Student                                                                    */
/* ========================================================================== */

export async function studentDashboard(user) {
  return buildStudentDashboard(user, user.id);
}

/** Parents get the same payload for whichever child they're viewing. */
export async function childDashboard(user, studentId) {
  const student = await assertCanViewStudent(user, studentId);
  const data = await buildStudentDashboard(user, studentId);
  return { ...data, student };
}

async function buildStudentDashboard(user, studentId) {
  const today = todayDateOnly();

  const enrolments = await prisma.enrollment.findMany({
    where: { studentId },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
          semester: true,
          subjects: { select: { id: true, name: true } },
        },
      },
    },
  });

  const classIds = enrolments.map((e) => e.class.id);
  const subjectIds = enrolments.flatMap((e) => e.class.subjects.map((s) => s.id));

  const [todayRecords, attendanceCounts, assignments, notices, results] = await Promise.all([
    // What was marked for this student today.
    prisma.attendanceRecord.findMany({
      where: { studentId, date: today },
      select: {
        status: true,
        periodNo: true,
        subject: { select: { id: true, name: true } },
      },
      orderBy: { periodNo: 'asc' },
    }),

    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { _all: true },
    }),

    classIds.length === 0
      ? []
      : prisma.assignment.findMany({
          where: { subject: { classId: { in: classIds } } },
          select: {
            id: true,
            title: true,
            dueDate: true,
            maxMarks: true,
            subject: { select: { name: true } },
            submissions: {
              where: { studentId },
              select: { id: true, submittedAt: true, isLate: true, isPublished: true, marksObtained: true },
            },
          },
          orderBy: { dueDate: 'asc' },
        }),

    noticesFor(studentId, classIds, enrolments.map((e) => e.class)),

    // Reuse the marksheet so the snapshot can never disagree with the
    // full results page.
    getStudentResults(user, studentId).catch(() => null),
  ]);

  // --- Attendance ---------------------------------------------------------
  const counts = {};
  for (const row of attendanceCounts) counts[row.status] = row._count._all;
  const attendance = summariseCounts(counts);

  // --- Assignments --------------------------------------------------------
  const now = new Date();
  const withStatus = assignments.map((a) => {
    const submission = a.submissions[0] ?? null;
    let status;
    if (submission) {
      status = submission.isPublished && submission.marksObtained !== null ? 'GRADED' : 'SUBMITTED';
    } else {
      status = new Date(a.dueDate) < now ? 'OVERDUE' : 'PENDING';
    }
    return {
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      maxMarks: a.maxMarks,
      subjectName: a.subject.name,
      status,
      isLate: submission?.isLate ?? false,
    };
  });

  const upcoming = withStatus
    .filter((a) => a.status === 'PENDING' && new Date(a.dueDate) <= addDays(now, UPCOMING_DAYS))
    .slice(0, 5);
  const overdue = withStatus.filter((a) => a.status === 'OVERDUE').slice(0, 5);

  return {
    today: formatDateOnly(today),
    threshold: env.attendanceThreshold,
    classes: enrolments.map((e) => ({
      id: e.class.id,
      name: e.class.name,
      section: e.class.section,
      academicYear: e.class.academicYear,
      semester: e.class.semester,
      subjectCount: e.class.subjects.length,
    })),
    todayAttendance: todayRecords.map((r) => ({
      subjectName: r.subject.name,
      periodNo: r.periodNo,
      status: r.status,
    })),
    attendance: {
      ...attendance,
      isDefaulter: attendance.percentage !== null && attendance.percentage < env.attendanceThreshold,
    },
    assignments: {
      upcoming,
      overdue,
      counts: withStatus.reduce(
        (acc, a) => {
          acc[a.status] += 1;
          acc.ALL += 1;
          return acc;
        },
        { ALL: 0, PENDING: 0, SUBMITTED: 0, GRADED: 0, OVERDUE: 0 }
      ),
    },
    notices,
    performance: results
      ? {
          cgpa: results.cgpa,
          percentage: results.overall.percentage,
          subjectsGraded: results.overall.subjectsGraded,
          subjectsFailed: results.overall.subjectsFailed,
          creditsEarned: results.overall.creditsEarned,
          creditsAttempted: results.overall.creditsAttempted,
          gpaScale: results.scale.gpaScale,
          // Last few assessments, for a sparkline.
          recent: results.timeline.slice(-5),
        }
      : null,
    // Only used by the parent view; harmless for a student.
    subjectCount: subjectIds.length,
  };
}

/**
 * Latest notices addressed to a student's classes.
 * Mirrors the audience rule in the notices module.
 */
async function noticesFor(studentId, classIds, classes) {
  if (classIds.length === 0) {
    return prisma.notice.findMany({
      where: { targetType: 'ALL' },
      select: noticeFields,
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
  }

  const namePairs = classes.map((c) => ({
    targetClassName: c.name,
    targetAcademicYear: c.academicYear,
  }));

  return prisma.notice.findMany({
    where: {
      OR: [
        { targetType: 'ALL' },
        { targetType: 'SECTION', targetClassId: { in: classIds } },
        { targetType: 'CLASS', OR: namePairs },
      ],
    },
    select: noticeFields,
    orderBy: { createdAt: 'desc' },
    take: 4,
  });
}

const noticeFields = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  targetType: true,
  postedBy: { select: { name: true } },
};

/* ========================================================================== */
/* Parent                                                                     */
/* ========================================================================== */

/** A compact row per linked child, for the parent's landing page. */
export async function parentDashboard(user) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    select: {
      relationship: true,
      student: { select: { id: true, name: true, rollNo: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (links.length === 0) return { children: [], threshold: env.attendanceThreshold };

  const children = await Promise.all(
    links.map(async (link) => {
      const studentId = link.student.id;

      const [attendanceCounts, overdueCount, pendingCount, ungradedResults] = await Promise.all([
        prisma.attendanceRecord.groupBy({
          by: ['status'],
          where: { studentId },
          _count: { _all: true },
        }),
        // Past due and never submitted.
        prisma.assignment.count({
          where: {
            dueDate: { lt: new Date() },
            subject: { class: { enrollments: { some: { studentId } } } },
            submissions: { none: { studentId } },
          },
        }),
        prisma.assignment.count({
          where: {
            dueDate: { gte: new Date() },
            subject: { class: { enrollments: { some: { studentId } } } },
            submissions: { none: { studentId } },
          },
        }),
        prisma.submission.count({ where: { studentId, ...RELEASED } }),
      ]);

      const counts = {};
      for (const row of attendanceCounts) counts[row.status] = row._count._all;
      const attendance = summariseCounts(counts);

      return {
        ...link.student,
        relationship: link.relationship,
        attendance: {
          percentage: attendance.percentage,
          attended: attendance.attended,
          counted: attendance.counted,
          isDefaulter:
            attendance.percentage !== null && attendance.percentage < env.attendanceThreshold,
        },
        assignments: { overdue: overdueCount, pending: pendingCount },
        releasedResults: ungradedResults,
      };
    })
  );

  return { children, threshold: env.attendanceThreshold };
}

/* -------------------------------------------------------------------------- */

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}
