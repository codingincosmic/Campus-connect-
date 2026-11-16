/**
 * ---------------------------------------------------------------------------
 * CLASSES / SUBJECTS / ENROLLMENT — business logic.
 * ---------------------------------------------------------------------------
 *
 * Visibility rule used throughout:
 *   ADMIN   sees every class.
 *   TEACHER sees only classes in which they are assigned at least one subject.
 *
 * That rule lives in `classFilterFor()` so it can't drift between endpoints.
 */
import { prisma } from '../../lib/prisma.js';
import { notFound, badRequest, conflict, forbidden } from '../../lib/errors.js';
import { toSkipTake, paginated } from '../../lib/pagination.js';

/** Fields returned for a class in list views. */
const classSelect = {
  id: true,
  name: true,
  section: true,
  academicYear: true,
  semester: true,
  createdAt: true,
  // Counts let the UI show "5 subjects · 8 students" without extra queries.
  _count: { select: { subjects: true, enrollments: true } },
};

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  credits: true,
  classId: true,
  teacherId: true,
  teacher: { select: { id: true, name: true, email: true } },
};

/**
 * Prisma `where` clause restricting classes to what this user may see.
 * @param {{ id: string, role: string }} user
 */
function classFilterFor(user) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'TEACHER') return { subjects: { some: { teacherId: user.id } } };
  // Students/parents don't use these endpoints; deny by default rather than
  // silently returning everything.
  throw forbidden('This area is for staff only.');
}

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export async function listClasses(user, { academicYear, search }) {
  const where = {
    ...classFilterFor(user),
    ...(academicYear ? { academicYear } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { section: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  return prisma.class.findMany({
    where,
    select: classSelect,
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }, { section: 'asc' }],
  });
}

/** One class, with its subjects. Throws 404 if the user may not see it. */
export async function getClass(user, classId) {
  const klass = await prisma.class.findFirst({
    where: { id: classId, ...classFilterFor(user) },
    select: {
      ...classSelect,
      subjects: { select: subjectSelect, orderBy: { name: 'asc' } },
    },
  });

  // 404 rather than 403 on purpose: a teacher shouldn't be able to discover
  // which class IDs exist by probing for a different error code.
  if (!klass) throw notFound('That class does not exist, or you do not have access to it.');
  return klass;
}

export async function createClass(data) {
  return prisma.class.create({ data, select: classSelect });
}

export async function updateClass(classId, data) {
  await ensureClassExists(classId);
  return prisma.class.update({ where: { id: classId }, data, select: classSelect });
}

/**
 * Deleting a class cascades to its subjects, enrollments and (through those)
 * attendance and assignments. That's a lot of data, so we refuse unless the
 * class is empty — the admin must clear it deliberately first.
 */
export async function deleteClass(classId) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, _count: { select: { subjects: true, enrollments: true } } },
  });
  if (!klass) throw notFound('That class does not exist.');

  const { subjects, enrollments } = klass._count;
  if (subjects > 0 || enrollments > 0) {
    throw conflict(
      `This class still has ${enrollments} student(s) and ${subjects} subject(s). ` +
        'Remove them before deleting the class.'
    );
  }

  await prisma.class.delete({ where: { id: classId } });
}

/* -------------------------------------------------------------------------- */
/* Subjects                                                                   */
/* -------------------------------------------------------------------------- */

export async function listSubjects(user, { classId, teacherId }) {
  const where = {
    ...(classId ? { classId } : {}),
    ...(teacherId ? { teacherId } : {}),
    // A teacher may only list subjects in classes they teach in.
    ...(user.role === 'TEACHER' ? { class: { subjects: { some: { teacherId: user.id } } } } : {}),
  };

  return prisma.subject.findMany({
    where,
    select: {
      ...subjectSelect,
      class: { select: { id: true, name: true, section: true, academicYear: true, semester: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
  });
}

export async function createSubject(data) {
  await ensureClassExists(data.classId);
  if (data.teacherId) await ensureIsTeacher(data.teacherId);

  return prisma.subject.create({
    data: { ...data, teacherId: data.teacherId ?? null },
    select: subjectSelect,
  });
}

export async function updateSubject(subjectId, data) {
  const existing = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!existing) throw notFound('That subject does not exist.');

  // `teacherId: null` is a meaningful value (unassign), so check for undefined.
  if (data.teacherId) await ensureIsTeacher(data.teacherId);

  return prisma.subject.update({ where: { id: subjectId }, data, select: subjectSelect });
}

/**
 * Refuse to delete a subject that already carries academic history —
 * dropping it would silently destroy attendance records and marks.
 */
export async function deleteSubject(subjectId) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, _count: { select: { attendance: true, assignments: true } } },
  });
  if (!subject) throw notFound('That subject does not exist.');

  const { attendance, assignments } = subject._count;
  if (attendance > 0 || assignments > 0) {
    throw conflict(
      `This subject has ${attendance} attendance record(s) and ${assignments} assignment(s). ` +
        'Deleting it would erase that history.'
    );
  }

  await prisma.subject.delete({ where: { id: subjectId } });
}

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                 */
/* -------------------------------------------------------------------------- */

/** Students enrolled in a class (the class roster). */
export async function listClassStudents(user, classId, { page, pageSize, search }) {
  await getClass(user, classId); // reuses the visibility check

  const where = {
    classId,
    ...(search
      ? {
          student: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { rollNo: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        student: {
          select: { id: true, name: true, email: true, rollNo: true, isActive: true },
        },
      },
      orderBy: { student: { rollNo: 'asc' } },
      ...toSkipTake({ page, pageSize }),
    }),
    prisma.enrollment.count({ where }),
  ]);

  const items = rows.map((row) => ({ ...row.student, enrolledAt: row.createdAt }));
  return paginated(items, total, { page, pageSize });
}

/**
 * Enroll students. Idempotent: `skipDuplicates` means re-adding someone who is
 * already enrolled is a no-op rather than an error.
 */
export async function enrollStudents(classId, studentIds) {
  await ensureClassExists(classId);

  // Verify every id really is a student before writing anything.
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: 'STUDENT' },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    throw badRequest('One or more of the selected users is not a student account.');
  }

  const result = await prisma.enrollment.createMany({
    data: students.map((s) => ({ classId, studentId: s.id })),
    skipDuplicates: true,
  });

  return { enrolled: result.count, alreadyEnrolled: studentIds.length - result.count };
}

export async function unenrollStudent(classId, studentId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
    select: { id: true },
  });
  if (!enrollment) throw notFound('That student is not enrolled in this class.');

  // Note: attendance and submissions are tied to the student + subject, not to
  // the enrollment row, so removing an enrollment does not delete history.
  await prisma.enrollment.delete({ where: { id: enrollment.id } });
}

/* -------------------------------------------------------------------------- */
/* Small shared guards                                                        */
/* -------------------------------------------------------------------------- */

async function ensureClassExists(classId) {
  const exists = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!exists) throw notFound('That class does not exist.');
}

async function ensureIsTeacher(teacherId) {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, isActive: true },
  });
  if (!teacher || teacher.role !== 'TEACHER') {
    throw badRequest('The selected user is not a teacher account.');
  }
  if (!teacher.isActive) {
    throw badRequest('That teacher account is deactivated.');
  }
}
