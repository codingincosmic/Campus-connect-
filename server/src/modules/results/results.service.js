/**
 * ---------------------------------------------------------------------------
 * RESULTS / MARKSHEET — business logic.
 * ---------------------------------------------------------------------------
 *
 * This module stores nothing. Everything is derived from graded, RELEASED
 * assignment submissions, so there is no second copy of the marks to drift out
 * of sync with what teachers actually entered.
 *
 * An "assessment" is just an assignment: a written test, a lab exercise and a
 * homework submission are all the same shape (a title, a maximum, a mark), so
 * they share one table rather than needing a separate `exams` model.
 *
 * The chain, per subject:
 *
 *   sum(marks) / sum(maxMarks) -> percentage -> letter grade -> grade point
 *
 * then, weighted by each subject's credits:
 *
 *   SGPA (one semester)   CGPA (everything so far)
 *
 * All of the bands and the scale live in src/config/grading.js.
 */
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { gradeFromMarks, weightedGpa, round2, GPA_SCALE, PASS_PERCENTAGE } from '../../config/grading.js';
import { assertCanViewStudent, assertCanTeachSubject, assertCanViewClass } from '../../lib/access.js';

/**
 * Only released marks count towards a result.
 *
 * A teacher may have entered marks but not clicked "Release results" yet; those
 * are deliberately invisible here, exactly as they are on the assignments page.
 */
const RELEASED = { isPublished: true, marksObtained: { not: null } };

/* ========================================================================== */
/* One student's marksheet                                                    */
/* ========================================================================== */

/**
 * Build a complete marksheet for one student.
 *
 * @returns {{ student, semesters: [], cgpa: number|null, overall: {}, timeline: [] }}
 */
export async function getStudentResults(user, studentId) {
  const student = await assertCanViewStudent(user, studentId);

  // Every class the student is enrolled in, with its subjects.
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
          subjects: {
            select: { id: true, name: true, code: true, credits: true },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });

  if (enrolments.length === 0) {
    return emptyMarksheet(student);
  }

  const subjectIds = enrolments.flatMap((e) => e.class.subjects.map((s) => s.id));

  // Every released mark this student has, across all their subjects.
  const submissions = await prisma.submission.findMany({
    where: { studentId, ...RELEASED, assignment: { subjectId: { in: subjectIds } } },
    select: {
      marksObtained: true,
      gradedAt: true,
      isLate: true,
      assignment: {
        select: { id: true, title: true, maxMarks: true, dueDate: true, subjectId: true },
      },
    },
    orderBy: { gradedAt: 'asc' },
  });

  /** subjectId -> submissions for that subject */
  const bySubject = new Map();
  for (const s of submissions) {
    const key = s.assignment.subjectId;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(s);
  }

  // --- One block per enrolled class, i.e. per semester ---------------------
  const semesters = enrolments
    .map(({ class: klass }) => {
      const subjects = klass.subjects.map((subject) => {
        const marks = bySubject.get(subject.id) ?? [];

        const obtained = marks.reduce((sum, m) => sum + m.marksObtained, 0);
        const maximum = marks.reduce((sum, m) => sum + m.assignment.maxMarks, 0);

        // A subject with nothing released yet is reported as "pending", not 0%.
        const graded = marks.length > 0 && maximum > 0;
        const result = graded ? gradeFromMarks(obtained, maximum) : null;

        return {
          subjectId: subject.id,
          name: subject.name,
          code: subject.code,
          credits: subject.credits,
          assessmentCount: marks.length,
          marksObtained: graded ? round2(obtained) : null,
          maxMarks: graded ? maximum : null,
          percentage: result?.percentage ?? null,
          grade: result?.grade ?? null,
          gradePoint: result?.point ?? null,
          label: result?.label ?? null,
          passed: result?.passed ?? null,
          // Every individual assessment, so the student can see the detail.
          assessments: marks.map((m) => ({
            assignmentId: m.assignment.id,
            title: m.assignment.title,
            marksObtained: m.marksObtained,
            maxMarks: m.assignment.maxMarks,
            percentage: round2((m.marksObtained / m.assignment.maxMarks) * 100),
            isLate: m.isLate,
            gradedAt: m.gradedAt,
            dueDate: m.assignment.dueDate,
          })),
        };
      });

      const gradedSubjects = subjects.filter((s) => s.gradePoint !== null);

      return {
        classId: klass.id,
        className: `${klass.name} — Section ${klass.section}`,
        academicYear: klass.academicYear,
        semester: klass.semester,
        subjects,
        // SGPA uses only subjects that actually have released marks.
        sgpa: weightedGpa(gradedSubjects.map((s) => ({ point: s.gradePoint, credits: s.credits }))),
        creditsEarned: gradedSubjects.filter((s) => s.passed).reduce((sum, s) => sum + s.credits, 0),
        creditsAttempted: gradedSubjects.reduce((sum, s) => sum + s.credits, 0),
        subjectsGraded: gradedSubjects.length,
        subjectsTotal: subjects.length,
      };
    })
    .sort((a, b) => a.academicYear.localeCompare(b.academicYear) || a.semester - b.semester);

  // --- Overall ------------------------------------------------------------
  const allGraded = semesters.flatMap((s) => s.subjects.filter((x) => x.gradePoint !== null));

  const cgpa = weightedGpa(allGraded.map((s) => ({ point: s.gradePoint, credits: s.credits })));

  const totalObtained = allGraded.reduce((sum, s) => sum + s.marksObtained, 0);
  const totalMax = allGraded.reduce((sum, s) => sum + s.maxMarks, 0);

  return {
    student,
    semesters,
    cgpa,
    overall: {
      percentage: totalMax > 0 ? round2((totalObtained / totalMax) * 100) : null,
      marksObtained: totalMax > 0 ? round2(totalObtained) : null,
      maxMarks: totalMax > 0 ? totalMax : null,
      subjectsGraded: allGraded.length,
      creditsEarned: allGraded.filter((s) => s.passed).reduce((sum, s) => sum + s.credits, 0),
      creditsAttempted: allGraded.reduce((sum, s) => sum + s.credits, 0),
      subjectsPassed: allGraded.filter((s) => s.passed).length,
      subjectsFailed: allGraded.filter((s) => s.passed === false).length,
    },
    // Assessment-by-assessment, oldest first — the "performance over time" chart.
    timeline: submissions.map((s) => ({
      title: s.assignment.title,
      percentage: round2((s.marksObtained / s.assignment.maxMarks) * 100),
      marksObtained: s.marksObtained,
      maxMarks: s.assignment.maxMarks,
      gradedAt: s.gradedAt,
    })),
    scale: { gpaScale: GPA_SCALE, passPercentage: PASS_PERCENTAGE },
  };
}

function emptyMarksheet(student) {
  return {
    student,
    semesters: [],
    cgpa: null,
    overall: {
      percentage: null,
      marksObtained: null,
      maxMarks: null,
      subjectsGraded: 0,
      creditsEarned: 0,
      creditsAttempted: 0,
      subjectsPassed: 0,
      subjectsFailed: 0,
    },
    timeline: [],
    scale: { gpaScale: GPA_SCALE, passPercentage: PASS_PERCENTAGE },
  };
}

/* ========================================================================== */
/* Class gradebook (staff)                                                    */
/* ========================================================================== */

/**
 * Every student in a class, with a mark per subject and their SGPA.
 * This is the teacher's/office's overview of how a whole class is doing.
 */
export async function getClassResults(user, classId) {
  const klass = await assertCanViewClass(user, classId);

  const [subjects, enrolments] = await Promise.all([
    prisma.subject.findMany({
      where: { classId },
      select: { id: true, name: true, code: true, credits: true },
      orderBy: { name: 'asc' },
    }),
    prisma.enrollment.findMany({
      where: { classId },
      select: { student: { select: { id: true, name: true, rollNo: true, email: true } } },
      orderBy: { student: { rollNo: 'asc' } },
    }),
  ]);

  const subjectIds = subjects.map((s) => s.id);
  const studentIds = enrolments.map((e) => e.student.id);

  const submissions =
    subjectIds.length === 0 || studentIds.length === 0
      ? []
      : await prisma.submission.findMany({
          where: {
            studentId: { in: studentIds },
            ...RELEASED,
            assignment: { subjectId: { in: subjectIds } },
          },
          select: {
            studentId: true,
            marksObtained: true,
            assignment: { select: { maxMarks: true, subjectId: true } },
          },
        });

  /** `${studentId}|${subjectId}` -> { obtained, max, count } */
  const totals = new Map();
  for (const s of submissions) {
    const key = `${s.studentId}|${s.assignment.subjectId}`;
    const current = totals.get(key) ?? { obtained: 0, max: 0, count: 0 };
    current.obtained += s.marksObtained;
    current.max += s.assignment.maxMarks;
    current.count += 1;
    totals.set(key, current);
  }

  const rows = enrolments.map(({ student }) => {
    const perSubject = subjects.map((subject) => {
      const t = totals.get(`${student.id}|${subject.id}`);
      const graded = t && t.max > 0;
      const result = graded ? gradeFromMarks(t.obtained, t.max) : null;

      return {
        subjectId: subject.id,
        name: subject.name,
        credits: subject.credits,
        marksObtained: graded ? round2(t.obtained) : null,
        maxMarks: graded ? t.max : null,
        percentage: result?.percentage ?? null,
        grade: result?.grade ?? null,
        gradePoint: result?.point ?? null,
        passed: result?.passed ?? null,
      };
    });

    const graded = perSubject.filter((s) => s.gradePoint !== null);
    const obtained = graded.reduce((sum, s) => sum + s.marksObtained, 0);
    const max = graded.reduce((sum, s) => sum + s.maxMarks, 0);

    return {
      student,
      subjects: perSubject,
      sgpa: weightedGpa(graded.map((s) => ({ point: s.gradePoint, credits: s.credits }))),
      percentage: max > 0 ? round2((obtained / max) * 100) : null,
      subjectsGraded: graded.length,
      subjectsFailed: graded.filter((s) => s.passed === false).length,
    };
  });

  const withSgpa = rows.filter((r) => r.sgpa !== null);

  return {
    class: klass,
    subjects,
    rows,
    stats: {
      students: rows.length,
      graded: withSgpa.length,
      classAverageSgpa:
        withSgpa.length > 0
          ? round2(withSgpa.reduce((sum, r) => sum + r.sgpa, 0) / withSgpa.length)
          : null,
      failing: rows.filter((r) => r.subjectsFailed > 0).length,
    },
    scale: { gpaScale: GPA_SCALE, passPercentage: PASS_PERCENTAGE },
  };
}

/* ========================================================================== */
/* CSV export                                                                 */
/* ========================================================================== */

/** Render a class gradebook as CSV for the office. */
export function classResultsToCsv(data) {
  const header = ['Roll No', 'Name'];
  for (const subject of data.subjects) {
    header.push(`${subject.name} (${subject.credits}cr)`, `${subject.name} Grade`);
  }
  header.push('Overall %', 'SGPA', 'Subjects failed');

  const lines = [
    csvRow([`Results — ${data.class.name} Section ${data.class.section}`]),
    csvRow([
      `Academic year: ${data.class.academicYear}`,
      `Semester: ${data.class.semester}`,
      `Scale: ${data.scale.gpaScale}-point`,
      `Pass mark: ${data.scale.passPercentage}%`,
    ]),
    '',
    csvRow(header),
    ...data.rows.map((row) => {
      const cells = [row.student.rollNo ?? '', row.student.name];
      for (const subject of row.subjects) {
        cells.push(
          subject.percentage === null ? '' : `${subject.marksObtained}/${subject.maxMarks}`,
          subject.grade ?? ''
        );
      }
      cells.push(row.percentage ?? '', row.sgpa ?? '', row.subjectsFailed);
      return csvRow(cells);
    }),
    '',
    csvRow(['Class average SGPA', data.stats.classAverageSgpa ?? '']),
    csvRow(['Students with a fail', data.stats.failing]),
  ];

  // UTF-8 BOM + CRLF so Excel on Windows opens it cleanly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection from user-supplied names.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvFilename(data) {
  const slug = `${data.class.name}-${data.class.section}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `results-${slug}.csv`;
}

/* ========================================================================== */
/* Subject gradebook (teacher)                                                */
/* ========================================================================== */

/** Every student's mark for one subject, assessment by assessment. */
export async function getSubjectResults(user, subjectId) {
  const subject = await assertCanTeachSubject(user, subjectId);

  const [assignments, enrolments, submissions] = await Promise.all([
    prisma.assignment.findMany({
      where: { subjectId },
      select: { id: true, title: true, maxMarks: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.enrollment.findMany({
      where: { classId: subject.class.id },
      select: { student: { select: { id: true, name: true, rollNo: true } } },
      orderBy: { student: { rollNo: 'asc' } },
    }),
    prisma.submission.findMany({
      where: { ...RELEASED, assignment: { subjectId } },
      select: {
        studentId: true,
        marksObtained: true,
        assignment: { select: { id: true, maxMarks: true } },
      },
    }),
  ]);

  const byKey = new Map(submissions.map((s) => [`${s.studentId}|${s.assignment.id}`, s]));

  const rows = enrolments.map(({ student }) => {
    const marks = assignments.map((assignment) => {
      const found = byKey.get(`${student.id}|${assignment.id}`);
      return {
        assignmentId: assignment.id,
        marksObtained: found ? found.marksObtained : null,
        maxMarks: assignment.maxMarks,
      };
    });

    const released = marks.filter((m) => m.marksObtained !== null);
    const obtained = released.reduce((sum, m) => sum + m.marksObtained, 0);
    const max = released.reduce((sum, m) => sum + m.maxMarks, 0);
    const result = max > 0 ? gradeFromMarks(obtained, max) : null;

    return {
      student,
      marks,
      total: max > 0 ? { obtained: round2(obtained), max, ...result } : null,
    };
  });

  return { subject, assignments, rows, scale: { gpaScale: GPA_SCALE, passPercentage: PASS_PERCENTAGE } };
}

/** Guard used by the controller when a class id is required. */
export async function ensureClassVisible(user, classId) {
  const klass = await assertCanViewClass(user, classId);
  if (!klass) throw notFound('That class does not exist.');
  return klass;
}
