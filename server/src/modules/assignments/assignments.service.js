/**
 * ---------------------------------------------------------------------------
 * ASSIGNMENTS + SUBMISSIONS — business logic.
 * ---------------------------------------------------------------------------
 *
 * Key decisions:
 *
 *   • A submission's `isLate` is computed on the server from the clock, never
 *     sent by the client.
 *   • Re-submitting replaces the previous file (one submission per student per
 *     assignment), and the old file is deleted from storage.
 *   • Marks are invisible to students and parents until the teacher publishes
 *     them, so a whole class can be graded before anyone sees a result.
 */
import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound, conflict } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { assertCanTeachSubject, assertCanViewStudent } from '../../lib/access.js';
import { gradeFromMarks } from '../../config/grading.js';

/* -------------------------------------------------------------------------- */
/* Shared shapes                                                              */
/* -------------------------------------------------------------------------- */

const assignmentSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  maxMarks: true,
  fileName: true,
  fileUrl: true,
  createdAt: true,
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      credits: true,
      teacherId: true,
      class: { select: { id: true, name: true, section: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
};

/**
 * Strip the internal storage key out of anything sent to a browser.
 *
 * The key is a server-side detail; exposing it would invite people to try
 * fetching files directly instead of going through the authorised route.
 */
function publicAssignment(assignment, extra = {}) {
  const { fileUrl, ...rest } = assignment;
  return {
    ...rest,
    hasFile: Boolean(fileUrl),
    /** Authorised download route — the browser sends the auth cookie with it. */
    fileDownloadUrl: fileUrl ? `/api/assignments/${assignment.id}/file` : null,
    ...extra,
  };
}

/**
 * Shape a submission for a STUDENT or PARENT.
 *
 * Marks are deliberately NOT included. Assignment marks are an official record
 * that belongs on the marksheet (the results module), so students and parents
 * see only that the work has been evaluated — never a number here.
 *
 * This is enforced server-side, not just hidden in the UI, so the marks cannot
 * be read by calling the API directly.
 */
function publicSubmission(submission) {
  const { fileUrl, marksObtained, feedback, gradedAt, ...rest } = submission;

  // "Evaluated" means the teacher has marked it AND published the result.
  const isEvaluated = submission.isPublished && marksObtained !== null;

  return {
    ...rest,
    isEvaluated,
    // Written feedback is teaching guidance rather than an official record,
    // so it is still shown once results are published.
    feedback: isEvaluated ? feedback : null,
    gradedAt: isEvaluated ? gradedAt : null,
    hasFile: Boolean(fileUrl),
    fileDownloadUrl: fileUrl ? `/api/assignments/submissions/${submission.id}/file` : null,
  };
}

/** Shape a submission for STAFF, who do see the marks. */
function staffSubmission(submission, maxMarks) {
  const { fileUrl, ...rest } = submission;
  return {
    ...rest,
    grade:
      submission.marksObtained !== null
        ? gradeFromMarks(submission.marksObtained, maxMarks)
        : null,
    hasFile: Boolean(fileUrl),
    fileDownloadUrl: fileUrl ? `/api/assignments/submissions/${submission.id}/file` : null,
  };
}

/**
 * Derive the student-facing status of an assignment.
 * Order matters: a graded submission is "graded" even if it was late.
 */
function statusFor(assignment, submission, now = new Date()) {
  if (submission) {
    // "GRADED" here means evaluated and released — the actual marks live on the
    // marksheet, not on this screen.
    if (submission.isPublished && submission.marksObtained !== null) return 'GRADED';
    return 'SUBMITTED';
  }
  return new Date(assignment.dueDate) < now ? 'OVERDUE' : 'PENDING';
}

/* ========================================================================== */
/* Teacher — create / update / delete                                         */
/* ========================================================================== */

export async function createAssignment(user, data, file) {
  await assertCanTeachSubject(user, data.subjectId);

  let stored = null;
  if (file) {
    stored = await storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      folder: 'assignments',
    });
  }

  const assignment = await prisma.assignment.create({
    data: {
      subjectId: data.subjectId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate,
      maxMarks: data.maxMarks,
      fileUrl: stored?.key ?? null,
      fileName: stored?.fileName ?? null,
      createdById: user.id,
    },
    select: assignmentSelect,
  });

  return publicAssignment(assignment, { submissionCount: 0, gradedCount: 0 });
}

export async function updateAssignment(user, assignmentId, data, file) {
  const existing = await loadForTeacher(user, assignmentId);

  let fileUrl = existing.fileUrl;
  let fileName = existing.fileName;

  if (file) {
    // Replacing: store the new file, then remove the old one.
    const stored = await storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      folder: 'assignments',
    });
    fileUrl = stored.key;
    fileName = stored.fileName;
    if (existing.fileUrl) await storage.remove(existing.fileUrl);
  } else if (data.removeFile && existing.fileUrl) {
    await storage.remove(existing.fileUrl);
    fileUrl = null;
    fileName = null;
  }

  const { removeFile, ...fields } = data;

  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { ...fields, fileUrl, fileName },
    select: assignmentSelect,
  });

  return publicAssignment(assignment);
}

/**
 * Delete an assignment. Refused once students have submitted work, because the
 * cascade would take their submissions and marks with it.
 */
export async function deleteAssignment(user, assignmentId) {
  const existing = await loadForTeacher(user, assignmentId);

  const submissionCount = await prisma.submission.count({ where: { assignmentId } });
  if (submissionCount > 0) {
    throw conflict(
      `${submissionCount} student(s) have already submitted work for this assignment. ` +
        'Deleting it would erase their submissions and marks.'
    );
  }

  await prisma.assignment.delete({ where: { id: assignmentId } });
  if (existing.fileUrl) await storage.remove(existing.fileUrl);
}

/** Load an assignment and confirm this teacher owns its subject. */
async function loadForTeacher(user, assignmentId) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, subjectId: true, fileUrl: true, fileName: true, maxMarks: true },
  });
  if (!assignment) throw notFound('That assignment does not exist.');

  await assertCanTeachSubject(user, assignment.subjectId);
  return assignment;
}

/* ========================================================================== */
/* Teacher — listing and submissions                                          */
/* ========================================================================== */

export async function listForStaff(user, { subjectId, classId }) {
  const where = {
    ...(subjectId ? { subjectId } : {}),
    ...(classId ? { subject: { classId } } : {}),
    // A teacher only ever sees assignments for subjects they teach.
    ...(user.role === 'TEACHER' ? { subject: { ...(classId ? { classId } : {}), teacherId: user.id } } : {}),
  };

  const assignments = await prisma.assignment.findMany({
    where,
    select: {
      ...assignmentSelect,
      submissions: { select: { id: true, marksObtained: true, isPublished: true, isLate: true } },
    },
    orderBy: { dueDate: 'desc' },
  });

  // Enrolment counts tell the teacher "12 of 30 submitted" at a glance.
  const classIds = [...new Set(assignments.map((a) => a.subject.class.id))];
  const enrolments = await prisma.enrollment.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds } },
    _count: { _all: true },
  });
  const classSize = new Map(enrolments.map((e) => [e.classId, e._count._all]));

  return assignments.map(({ submissions, ...assignment }) =>
    publicAssignment(assignment, {
      submissionCount: submissions.length,
      gradedCount: submissions.filter((s) => s.marksObtained !== null).length,
      publishedCount: submissions.filter((s) => s.isPublished).length,
      lateCount: submissions.filter((s) => s.isLate).length,
      classSize: classSize.get(assignment.subject.class.id) ?? 0,
    })
  );
}

/**
 * The grading view: every enrolled student, with their submission if any.
 * Students who haven't submitted are included so the teacher can see gaps.
 */
export async function listSubmissions(user, assignmentId) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: assignmentSelect,
  });
  if (!assignment) throw notFound('That assignment does not exist.');

  await assertCanTeachSubject(user, assignment.subject.id);

  const [enrolments, submissions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: assignment.subject.class.id },
      select: { student: { select: { id: true, name: true, rollNo: true, email: true } } },
      orderBy: { student: { rollNo: 'asc' } },
    }),
    prisma.submission.findMany({
      where: { assignmentId },
      select: {
        id: true,
        studentId: true,
        fileUrl: true,
        fileName: true,
        submittedAt: true,
        isLate: true,
        marksObtained: true,
        feedback: true,
        gradedAt: true,
        isPublished: true,
        gradedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const rows = enrolments.map(({ student }) => {
    const submission = byStudent.get(student.id);
    return {
      student,
      // Teachers always see marks, published or not.
      submission: submission ? staffSubmission(submission, assignment.maxMarks) : null,
      status: statusFor(assignment, submission),
    };
  });

  return {
    assignment: publicAssignment(assignment),
    rows,
    stats: {
      total: rows.length,
      submitted: rows.filter((r) => r.submission).length,
      late: rows.filter((r) => r.submission?.isLate).length,
      graded: rows.filter((r) => r.submission?.marksObtained !== null && r.submission).length,
      published: rows.filter((r) => r.submission?.isPublished).length,
    },
  };
}

/* ========================================================================== */
/* Teacher — grading                                                          */
/* ========================================================================== */

export async function gradeSubmission(user, submissionId, data) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      assignment: { select: { id: true, subjectId: true, maxMarks: true } },
    },
  });
  if (!submission) throw notFound('That submission does not exist.');

  await assertCanTeachSubject(user, submission.assignment.subjectId);

  // Marks above the maximum are almost always a typo — catch it here rather
  // than letting a 150% appear on a report card.
  if (
    data.marksObtained !== undefined &&
    data.marksObtained !== null &&
    data.marksObtained > submission.assignment.maxMarks
  ) {
    throw badRequest(
      `Marks cannot exceed the maximum of ${submission.assignment.maxMarks}.`,
      { fieldErrors: { marksObtained: `Maximum is ${submission.assignment.maxMarks}.` } }
    );
  }

  const hasMarks = data.marksObtained !== undefined && data.marksObtained !== null;

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      ...(data.marksObtained !== undefined ? { marksObtained: data.marksObtained } : {}),
      ...(data.feedback !== undefined ? { feedback: data.feedback ?? null } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      // Stamp the grader only when marks are actually being recorded.
      ...(hasMarks ? { gradedAt: new Date(), gradedById: user.id } : {}),
      // Clearing the marks clears the grading metadata too.
      ...(data.marksObtained === null
        ? { gradedAt: null, gradedById: null, isPublished: false }
        : {}),
    },
    select: {
      id: true,
      studentId: true,
      fileUrl: true,
      fileName: true,
      submittedAt: true,
      isLate: true,
      marksObtained: true,
      feedback: true,
      gradedAt: true,
      isPublished: true,
    },
  });

  return {
    ...updated,
    grade:
      updated.marksObtained !== null
        ? gradeFromMarks(updated.marksObtained, submission.assignment.maxMarks)
        : null,
  };
}

/** Publish (or unpublish) every graded submission for an assignment at once. */
export async function publishAll(user, assignmentId, isPublished) {
  const assignment = await loadForTeacher(user, assignmentId);

  const result = await prisma.submission.updateMany({
    // Only touch submissions that actually have a mark — publishing an ungraded
    // submission would show the student an empty result.
    where: { assignmentId: assignment.id, marksObtained: { not: null } },
    data: { isPublished },
  });

  return { updated: result.count, isPublished };
}

/* ========================================================================== */
/* Student — viewing and submitting                                           */
/* ========================================================================== */

/**
 * Assignments for one student, each with their submission and derived status.
 * Used by both the student's own page and a parent viewing their child.
 */
export async function listForStudent(user, studentId, { status, subjectId }) {
  const student = await assertCanViewStudent(user, studentId);

  const enrolments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classId: true },
  });
  const classIds = enrolments.map((e) => e.classId);

  if (classIds.length === 0) {
    return { student, items: [], counts: emptyCounts() };
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      subject: { classId: { in: classIds }, ...(subjectId ? { id: subjectId } : {}) },
    },
    select: {
      ...assignmentSelect,
      submissions: {
        where: { studentId },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          submittedAt: true,
          isLate: true,
          marksObtained: true,
          feedback: true,
          gradedAt: true,
          isPublished: true,
        },
      },
    },
    orderBy: { dueDate: 'desc' },
  });

  const now = new Date();

  const items = assignments.map(({ submissions, ...assignment }) => {
    const submission = submissions[0] ?? null;
    return publicAssignment(assignment, {
      status: statusFor(assignment, submission, now),
      // No marks here by design — see publicSubmission.
      submission: submission ? publicSubmission(submission) : null,
      canSubmit: true,
      isOverdue: new Date(assignment.dueDate) < now,
    });
  });

  const counts = items.reduce((acc, item) => {
    acc[item.status] += 1;
    acc.ALL += 1;
    return acc;
  }, emptyCounts());

  return {
    student,
    items: status === 'ALL' ? items : items.filter((i) => i.status === status),
    counts,
  };
}

function emptyCounts() {
  return { ALL: 0, PENDING: 0, SUBMITTED: 0, GRADED: 0, OVERDUE: 0 };
}

/**
 * Submit (or re-submit) work.
 *
 * Late submissions are ACCEPTED but flagged — a college usually wants the work
 * even if it's late, and wants the teacher to know it was late.
 */
export async function submitAssignment(user, assignmentId, file) {
  if (!file) throw badRequest('Choose a file to upload.');

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      dueDate: true,
      maxMarks: true,
      subject: { select: { id: true, classId: true, name: true } },
    },
  });
  if (!assignment) throw notFound('That assignment does not exist.');

  // The student must be enrolled in the class this assignment belongs to.
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: user.id, classId: assignment.subject.classId } },
    select: { id: true },
  });
  if (!enrolled) throw forbidden('This assignment is not for one of your classes.');

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    select: { id: true, fileUrl: true, isPublished: true, marksObtained: true },
  });

  // Once a mark has been published, the work is final.
  if (existing?.isPublished && existing.marksObtained !== null) {
    throw conflict('This assignment has already been graded, so it can no longer be changed.');
  }

  const stored = await storage.save({
    buffer: file.buffer,
    originalName: file.originalname,
    folder: `submissions/${assignmentId}`,
  });

  const submittedAt = new Date();
  const isLate = submittedAt > new Date(assignment.dueDate);

  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    create: {
      assignmentId,
      studentId: user.id,
      fileUrl: stored.key,
      fileName: stored.fileName,
      submittedAt,
      isLate,
    },
    update: {
      fileUrl: stored.key,
      fileName: stored.fileName,
      submittedAt,
      isLate,
      // A resubmission invalidates any provisional marking.
      marksObtained: null,
      feedback: null,
      gradedAt: null,
      gradedById: null,
      isPublished: false,
    },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      submittedAt: true,
      isLate: true,
      marksObtained: true,
      feedback: true,
      gradedAt: true,
      isPublished: true,
    },
  });

  // Clean up the replaced file only after the new one is safely recorded.
  if (existing?.fileUrl && existing.fileUrl !== stored.key) {
    await storage.remove(existing.fileUrl);
  }

  return { ...publicSubmission(submission), isLate };
}

/* ========================================================================== */
/* Downloads                                                                  */
/* ========================================================================== */

/**
 * Fetch an assignment's attachment, checking the caller may have it.
 *
 * Files are streamed through this authorised route rather than served
 * statically, so a storage key alone is never enough to read a file.
 */
export async function readAssignmentFile(user, assignmentId) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      subject: { select: { id: true, classId: true, teacherId: true } },
    },
  });
  if (!assignment?.fileUrl) throw notFound('That assignment has no attachment.');

  await assertCanSeeAssignment(user, assignment);

  return { buffer: await storage.read(assignment.fileUrl), fileName: assignment.fileName };
}

/**
 * Fetch a student's submitted file.
 * Readable by the submitting student, their linked parents, and the teacher of
 * the subject (plus admins).
 */
export async function readSubmissionFile(user, submissionId) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      fileUrl: true,
      fileName: true,
      assignment: { select: { subjectId: true } },
    },
  });
  if (!submission?.fileUrl) throw notFound('That submission has no file.');

  if (user.role === 'TEACHER' || user.role === 'ADMIN') {
    await assertCanTeachSubject(user, submission.assignment.subjectId);
  } else {
    // Students and parents: reuse the single student-visibility rule.
    await assertCanViewStudent(user, submission.studentId);
  }

  return { buffer: await storage.read(submission.fileUrl), fileName: submission.fileName };
}

/** May this user see this assignment at all? */
async function assertCanSeeAssignment(user, assignment) {
  if (user.role === 'ADMIN') return;

  if (user.role === 'TEACHER') {
    await assertCanTeachSubject(user, assignment.subject.id);
    return;
  }

  if (user.role === 'STUDENT') {
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: user.id, classId: assignment.subject.classId } },
      select: { id: true },
    });
    if (!enrolled) throw forbidden('This assignment is not for one of your classes.');
    return;
  }

  if (user.role === 'PARENT') {
    // Visible if any linked child is in the assignment's class.
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentId: user.id,
        student: { enrollments: { some: { classId: assignment.subject.classId } } },
      },
      select: { id: true },
    });
    if (!link) throw forbidden('This assignment is not for your child’s class.');
    return;
  }

  throw forbidden('You do not have access to this assignment.');
}
