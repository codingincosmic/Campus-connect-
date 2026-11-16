/**
 * ---------------------------------------------------------------------------
 * USER MANAGEMENT — admin creates and maintains all accounts.
 * ---------------------------------------------------------------------------
 *
 * There is no public signup, so this module is the only way accounts come into
 * existence (apart from the seed script).
 */
import { prisma } from '../../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../../lib/password.js';
import { notFound, badRequest, conflict } from '../../lib/errors.js';
import { toSkipTake, paginated } from '../../lib/pagination.js';
import { PUBLIC_USER_FIELDS } from '../../middleware/auth.js';

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */

export async function listUsers({ page, pageSize, role, search, classId, notInClassId, isActive }) {
  const where = {
    ...(role ? { role } : {}),
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { rollNo: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    // Enrolled in a given class...
    ...(classId ? { enrollments: { some: { classId } } } : {}),
    // ...or explicitly NOT enrolled, which is what the "add students" picker needs.
    ...(notInClassId ? { enrollments: { none: { classId: notInClassId } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...PUBLIC_USER_FIELDS,
        _count: { select: { enrollments: true, parentLinks: true, taughtSubjects: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      ...toSkipTake({ page, pageSize }),
    }),
    prisma.user.count({ where }),
  ]);

  return paginated(items, total, { page, pageSize });
}

/** One user, with the relations that matter for their role. */
export async function getUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_USER_FIELDS,
      enrollments: {
        select: {
          class: { select: { id: true, name: true, section: true, academicYear: true, semester: true } },
        },
      },
      taughtSubjects: {
        select: {
          id: true,
          name: true,
          code: true,
          credits: true,
          class: { select: { id: true, name: true, section: true } },
        },
      },
      parentLinks: {
        select: {
          relationship: true,
          student: { select: { id: true, name: true, rollNo: true, email: true } },
        },
      },
      childLinks: {
        select: {
          relationship: true,
          parent: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!user) throw notFound('That user does not exist.');
  return user;
}

/* -------------------------------------------------------------------------- */
/* Creating                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Create an account. Optionally enrolls a student or links a parent's children
 * in the same transaction, so a half-created user can never be left behind.
 *
 * @returns the new user plus `tempPassword` when one was generated. That value
 *          is shown to the admin exactly once and never stored in plain text.
 */
export async function createUser(input, createdById) {
  const { password, classId, childIds, ...userData } = input;

  // Generate a password when the admin didn't set one.
  const generated = password ? null : generateTempPassword();
  const plainPassword = password ?? generated;

  if (classId) await ensureClassExists(classId);
  if (childIds?.length) await ensureAllAreStudents(childIds);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...userData,
        passwordHash: await hashPassword(plainPassword),
        // Admin-created accounts always force a password change on first login,
        // so the admin never knows the user's long-term password.
        mustChangePassword: true,
        createdById,
      },
      select: PUBLIC_USER_FIELDS,
    });

    if (classId) {
      await tx.enrollment.create({ data: { studentId: created.id, classId } });
    }

    if (childIds?.length) {
      await tx.parentStudentLink.createMany({
        data: childIds.map((studentId) => ({ parentId: created.id, studentId })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  // Only return the password when WE generated it — if the admin chose one,
  // they already know it and there's no reason to echo it back.
  return { user, tempPassword: generated };
}

/* -------------------------------------------------------------------------- */
/* Updating                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateUser(userId, data, actingUserId) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!existing) throw notFound('That user does not exist.');

  // Guard against an admin locking themselves out of their own account.
  if (data.isActive === false && userId === actingUserId) {
    throw badRequest('You cannot deactivate your own account.');
  }

  return prisma.user.update({ where: { id: userId }, data, select: PUBLIC_USER_FIELDS });
}

/**
 * Reset someone's password (the v1 "forgot password" flow: the user asks the
 * college office, who resets it here).
 */
export async function resetPassword(userId, newPassword) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw notFound('That user does not exist.');

  const generated = newPassword ? null : generateTempPassword();
  const plainPassword = newPassword ?? generated;

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(plainPassword),
      // Force them to pick their own password on next login.
      mustChangePassword: true,
    },
  });

  return { tempPassword: generated };
}

/**
 * Delete an account. Refused when the user has academic history, because the
 * cascade would silently erase attendance records and submissions — deactivate
 * instead, which keeps the history but blocks login.
 */
export async function deleteUser(userId, actingUserId) {
  if (userId === actingUserId) throw badRequest('You cannot delete your own account.');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      _count: {
        select: { attendance: true, submissions: true, taughtSubjects: true, enrollments: true },
      },
    },
  });
  if (!user) throw notFound('That user does not exist.');

  const { attendance, submissions, taughtSubjects } = user._count;
  if (attendance > 0 || submissions > 0 || taughtSubjects > 0) {
    throw conflict(
      'This account has academic records attached (attendance, submissions or assigned subjects). ' +
        'Deactivate it instead of deleting, so the history is preserved.'
    );
  }

  await prisma.user.delete({ where: { id: userId } });
}

/* -------------------------------------------------------------------------- */
/* Parent <-> student links                                                   */
/* -------------------------------------------------------------------------- */

export async function listChildren(parentId) {
  await ensureIsRole(parentId, 'PARENT', 'That user is not a parent account.');

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId },
    select: {
      relationship: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          rollNo: true,
          isActive: true,
          enrollments: {
            select: { class: { select: { id: true, name: true, section: true, academicYear: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return links.map((link) => ({
    ...link.student,
    relationship: link.relationship,
    linkedAt: link.createdAt,
    classes: link.student.enrollments.map((e) => e.class),
  }));
}

export async function linkChildren(parentId, studentIds, relationship) {
  await ensureIsRole(parentId, 'PARENT', 'That user is not a parent account.');
  await ensureAllAreStudents(studentIds);

  const result = await prisma.parentStudentLink.createMany({
    data: studentIds.map((studentId) => ({ parentId, studentId, relationship: relationship ?? null })),
    skipDuplicates: true,
  });

  return { linked: result.count, alreadyLinked: studentIds.length - result.count };
}

export async function unlinkChild(parentId, studentId) {
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
    select: { id: true },
  });
  if (!link) throw notFound('That student is not linked to this parent.');

  await prisma.parentStudentLink.delete({ where: { id: link.id } });
}

/* -------------------------------------------------------------------------- */
/* Shared guards                                                              */
/* -------------------------------------------------------------------------- */

async function ensureClassExists(classId) {
  const exists = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!exists) throw badRequest('The selected class does not exist.');
}

async function ensureIsRole(userId, role, message) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw notFound('That user does not exist.');
  if (user.role !== role) throw badRequest(message);
}

async function ensureAllAreStudents(studentIds) {
  const found = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: 'STUDENT' },
    select: { id: true },
  });
  if (found.length !== studentIds.length) {
    throw badRequest('One or more of the selected users is not a student account.');
  }
}
