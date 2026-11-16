/**
 * ---------------------------------------------------------------------------
 * AUTH SERVICE — business logic only, no HTTP.
 * ---------------------------------------------------------------------------
 *
 * Controllers deal with req/res; services deal with data and rules. Keeping
 * them apart means this logic is easy to read and easy to test.
 */
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { unauthorized, forbidden, badRequest } from '../../lib/errors.js';
import { PUBLIC_USER_FIELDS } from '../../middleware/auth.js';

/**
 * Find a user by email OR username and check their password.
 *
 * Security note: we return the SAME message whether the account doesn't exist
 * or the password is wrong. Saying "no such user" would let someone probe which
 * email addresses are registered at the college.
 *
 * @param {{ identifier: string, password: string }} credentials
 */
export async function authenticate({ identifier, password }) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  const genericFailure = unauthorized('Incorrect email/username or password.');

  if (!user) {
    // Hash a dummy password anyway so a missing account doesn't respond
    // measurably faster than a wrong password (timing attack hardening).
    await verifyPassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw genericFailure;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) throw genericFailure;

  if (!user.isActive) {
    throw forbidden('Your account has been deactivated. Please contact the college office.');
  }

  return stripSensitive(user);
}

/**
 * Load a user plus the role-specific context the dashboard needs, in one call:
 *   TEACHER -> the subjects (and their classes) they teach
 *   STUDENT -> the classes they are enrolled in
 *   PARENT  -> their linked children
 *
 * @param {{ id: string, role: string }} user
 */
export async function getContextFor(user) {
  if (user.role === 'TEACHER') {
    const subjects = await prisma.subject.findMany({
      where: { teacherId: user.id },
      select: {
        id: true,
        name: true,
        code: true,
        credits: true,
        class: { select: { id: true, name: true, section: true, academicYear: true, semester: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    });
    return { subjects };
  }

  if (user.role === 'STUDENT') {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: {
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            academicYear: true,
            semester: true,
            subjects: { select: { id: true, name: true, code: true, credits: true } },
          },
        },
      },
    });
    return { classes: enrollments.map((e) => e.class) };
  }

  if (user.role === 'PARENT') {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: user.id },
      select: {
        relationship: true,
        student: {
          select: {
            id: true,
            name: true,
            rollNo: true,
            enrollments: {
              select: {
                class: { select: { id: true, name: true, section: true, academicYear: true, semester: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Flatten so the frontend gets a simple list of children with their class.
    const children = links.map((link) => ({
      id: link.student.id,
      name: link.student.name,
      rollNo: link.student.rollNo,
      relationship: link.relationship,
      classes: link.student.enrollments.map((e) => e.class),
    }));
    return { children };
  }

  // ADMIN needs no extra scoping — they can see everything.
  return {};
}

/**
 * Change your own password. Requires the current password, so a stolen session
 * alone cannot lock the real owner out.
 *
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string }} input
 */
export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('Your account no longer exists.');

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw badRequest('Your current password is not correct.', {
      fieldErrors: { currentPassword: 'Your current password is not correct.' },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      // The forced-change flag has served its purpose.
      mustChangePassword: false,
    },
  });
}

/** Re-read a user with only the browser-safe columns. */
export async function getPublicUser(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_FIELDS });
}

/** Drop passwordHash (and anything else private) before sending to a client. */
function stripSensitive(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
