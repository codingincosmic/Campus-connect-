/**
 * ---------------------------------------------------------------------------
 * SHARED ACCESS CHECKS
 * ---------------------------------------------------------------------------
 *
 * `requireRole` answers "is this user a teacher?". These functions answer the
 * harder question: "is this THEIR student / THEIR subject?".
 *
 * They live here rather than inside one module because attendance, assignments
 * and results all need the same rules — and a rule that's copied is a rule that
 * eventually diverges.
 */
import { prisma } from './prisma.js';
import { forbidden, notFound } from './errors.js';

/**
 * Confirm the user may act on a subject, and return it.
 *
 * ADMIN   — any subject.
 * TEACHER — only subjects they are assigned to.
 *
 * @returns the subject with its class attached
 */
export async function assertCanTeachSubject(user, subjectId) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      code: true,
      credits: true,
      teacherId: true,
      class: { select: { id: true, name: true, section: true, academicYear: true, semester: true } },
    },
  });

  if (!subject) throw notFound('That subject does not exist.');
  if (user.role === 'ADMIN') return subject;

  if (user.role !== 'TEACHER' || subject.teacherId !== user.id) {
    throw forbidden('You can only manage subjects you are assigned to teach.');
  }

  return subject;
}

/**
 * Confirm the user may view a student's records, and return the student.
 *
 * ADMIN   — anyone.
 * TEACHER — students enrolled in a class where they teach a subject.
 * STUDENT — only themselves.
 * PARENT  — only students linked to them.
 */
export async function assertCanViewStudent(user, studentId) {
  // Cheapest check first: a student looking at their own records.
  if (user.role === 'STUDENT' && user.id !== studentId) {
    throw forbidden('You can only view your own records.');
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: 'STUDENT' },
    select: { id: true, name: true, rollNo: true, email: true },
  });
  if (!student) throw notFound('That student does not exist.');

  if (user.role === 'ADMIN' || user.role === 'STUDENT') return student;

  if (user.role === 'PARENT') {
    const link = await prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId: user.id, studentId } },
      select: { id: true },
    });
    if (!link) throw forbidden('You can only view students linked to your account.');
    return student;
  }

  if (user.role === 'TEACHER') {
    // Shares at least one class with a subject this teacher owns.
    const shared = await prisma.enrollment.findFirst({
      where: {
        studentId,
        class: { subjects: { some: { teacherId: user.id } } },
      },
      select: { id: true },
    });
    if (!shared) throw forbidden('You can only view students in the classes you teach.');
    return student;
  }

  throw forbidden('You do not have access to this student.');
}

/**
 * Confirm the user may view a class, and return it.
 * Same visibility rule as the classes module: teachers see classes they teach in.
 */
export async function assertCanViewClass(user, classId) {
  const where =
    user.role === 'ADMIN'
      ? { id: classId }
      : { id: classId, subjects: { some: { teacherId: user.id } } };

  const klass = await prisma.class.findFirst({
    where,
    select: { id: true, name: true, section: true, academicYear: true, semester: true },
  });

  // 404 not 403, so a teacher can't probe which class IDs exist.
  if (!klass) throw notFound('That class does not exist, or you do not have access to it.');
  return klass;
}

/*
 * NOTE: a `viewableStudentIds(user)` helper used to live here, returning the
 * full list of student ids a user may see. It was removed because nothing used
 * it, and for an ADMIN it loaded EVERY student id into memory — which is
 * harmless with 10 students and wasteful with 2000.
 *
 * If you need something like it, scope the query instead: filter inside the
 * database with a nested `where` (as the functions above do) rather than
 * fetching a list of ids to filter by afterwards.
 */
