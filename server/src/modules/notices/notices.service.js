/**
 * ---------------------------------------------------------------------------
 * NOTICES — business logic.
 * ---------------------------------------------------------------------------
 *
 * Targeting:
 *   ALL     -> everyone in the college
 *   CLASS   -> every section of one class name, within one academic year
 *   SECTION -> one specific class+section row
 *
 * Who may post what:
 *   ADMIN   -> all three
 *   TEACHER -> SECTION only, and only for classes they actually teach in.
 *              College-wide announcements are the office's job, and letting a
 *              teacher post to sections they don't teach would be a nuisance
 *              channel with no oversight.
 *
 * Who SEES a notice is decided by `audienceFilter()` — one function, reused by
 * the feed, the single-notice fetch, the unread count and the file download, so
 * the four can never disagree about who is allowed to read what.
 */
import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { toSkipTake, paginated } from '../../lib/pagination.js';

const noticeSelect = {
  id: true,
  title: true,
  body: true,
  fileName: true,
  fileUrl: true,
  targetType: true,
  targetClassId: true,
  targetClassName: true,
  targetAcademicYear: true,
  createdAt: true,
  postedBy: { select: { id: true, name: true, role: true } },
  targetClass: { select: { id: true, name: true, section: true, academicYear: true } },
};

/** Strip the internal storage key and add a human-readable audience label. */
function publicNotice(notice, { isRead = false } = {}) {
  const { fileUrl, ...rest } = notice;
  return {
    ...rest,
    audience: audienceLabel(notice),
    hasFile: Boolean(fileUrl),
    fileDownloadUrl: fileUrl ? `/api/notices/${notice.id}/file` : null,
    isRead,
  };
}

function audienceLabel(notice) {
  if (notice.targetType === 'ALL') return 'Whole college';
  if (notice.targetType === 'CLASS') {
    return `${notice.targetClassName} — all sections (${notice.targetAcademicYear})`;
  }
  return notice.targetClass
    ? `${notice.targetClass.name} — Section ${notice.targetClass.section}`
    : 'A section';
}

/* ========================================================================== */
/* Who can see what                                                           */
/* ========================================================================== */

/**
 * Build the Prisma `where` fragment limiting notices to this user's audience.
 *
 * @param {{ id: string, role: string }} user
 */
async function audienceFilter(user) {
  // The office sees everything, including notices they didn't post.
  if (user.role === 'ADMIN') return {};

  const classes = await classesForUser(user);

  if (classes.length === 0) {
    // Not attached to any class yet — college-wide notices only.
    return { targetType: 'ALL' };
  }

  const classIds = classes.map((c) => c.id);
  // CLASS targeting is name + year, so match on the pair.
  const namePairs = classes.map((c) => ({
    targetClassName: c.name,
    targetAcademicYear: c.academicYear,
  }));

  return {
    OR: [
      { targetType: 'ALL' },
      { targetType: 'SECTION', targetClassId: { in: classIds } },
      { targetType: 'CLASS', OR: namePairs },
      // A teacher always sees their own notices, even if they later stop
      // teaching that class.
      ...(user.role === 'TEACHER' ? [{ postedById: user.id }] : []),
    ],
  };
}

/**
 * The classes a user is attached to:
 *   TEACHER -> classes they teach a subject in
 *   STUDENT -> classes they're enrolled in
 *   PARENT  -> classes their linked children are enrolled in
 */
async function classesForUser(user) {
  if (user.role === 'TEACHER') {
    return prisma.class.findMany({
      where: { subjects: { some: { teacherId: user.id } } },
      select: { id: true, name: true, section: true, academicYear: true },
    });
  }

  if (user.role === 'STUDENT') {
    const enrolments = await prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { class: { select: { id: true, name: true, section: true, academicYear: true } } },
    });
    return enrolments.map((e) => e.class);
  }

  if (user.role === 'PARENT') {
    const enrolments = await prisma.enrollment.findMany({
      where: { student: { childLinks: { some: { parentId: user.id } } } },
      select: { class: { select: { id: true, name: true, section: true, academicYear: true } } },
    });
    // A parent with two children in the same class would otherwise see dupes.
    const seen = new Map();
    for (const e of enrolments) seen.set(e.class.id, e.class);
    return [...seen.values()];
  }

  return [];
}

/* ========================================================================== */
/* Reading                                                                    */
/* ========================================================================== */

export async function listNotices(user, { page, pageSize, unreadOnly, search }) {
  const audience = await audienceFilter(user);

  const where = {
    AND: [
      audience,
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
              ],
            },
          ]
        : []),
      // "Unread" = no NoticeRead row for this user.
      ...(unreadOnly ? [{ reads: { none: { userId: user.id } } }] : []),
    ],
  };

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      where,
      select: {
        ...noticeSelect,
        // Only this user's read row, so we can flag each notice cheaply.
        reads: { where: { userId: user.id }, select: { readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, pageSize }),
    }),
    prisma.notice.count({ where }),
  ]);

  const items = notices.map(({ reads, ...notice }) =>
    publicNotice(notice, { isRead: reads.length > 0 })
  );

  return paginated(items, total, { page, pageSize });
}

export async function getNotice(user, noticeId) {
  const audience = await audienceFilter(user);

  const notice = await prisma.notice.findFirst({
    where: { AND: [{ id: noticeId }, audience] },
    select: { ...noticeSelect, reads: { where: { userId: user.id }, select: { readAt: true } } },
  });

  // 404 rather than 403: a user shouldn't be able to confirm a notice exists
  // just because it wasn't addressed to them.
  if (!notice) throw notFound('That notice does not exist, or it is not addressed to you.');

  const { reads, ...rest } = notice;
  return publicNotice(rest, { isRead: reads.length > 0 });
}

/** Count for the "unread" badge. */
export async function unreadCount(user) {
  const audience = await audienceFilter(user);
  const count = await prisma.notice.count({
    where: { AND: [audience, { reads: { none: { userId: user.id } } }] },
  });
  return { unread: count };
}

/* ========================================================================== */
/* Read tracking                                                              */
/* ========================================================================== */

export async function markRead(user, noticeId) {
  // Reuse the visibility check so nobody can mark a notice they can't see.
  await getNotice(user, noticeId);

  await prisma.noticeRead.upsert({
    where: { noticeId_userId: { noticeId, userId: user.id } },
    update: {}, // already read — keep the original timestamp
    create: { noticeId, userId: user.id },
  });

  return { ok: true };
}

export async function markAllRead(user) {
  const audience = await audienceFilter(user);

  const unread = await prisma.notice.findMany({
    where: { AND: [audience, { reads: { none: { userId: user.id } } }] },
    select: { id: true },
  });

  if (unread.length === 0) return { marked: 0 };

  const result = await prisma.noticeRead.createMany({
    data: unread.map((n) => ({ noticeId: n.id, userId: user.id })),
    skipDuplicates: true,
  });

  return { marked: result.count };
}

/* ========================================================================== */
/* Writing                                                                    */
/* ========================================================================== */

/**
 * Validate the target and check this user may post to it.
 * Returns the fields to persist.
 */
async function resolveTarget(user, { targetType, targetClassId }) {
  if (targetType === 'ALL') {
    if (user.role !== 'ADMIN') {
      throw forbidden(
        'Only an administrator can post a college-wide notice. Choose one of your classes instead.'
      );
    }
    return { targetType, targetClassId: null, targetClassName: null, targetAcademicYear: null };
  }

  const klass = await prisma.class.findUnique({
    where: { id: targetClassId },
    select: { id: true, name: true, section: true, academicYear: true },
  });
  if (!klass) throw badRequest('The class you selected does not exist.');

  if (user.role === 'TEACHER') {
    if (targetType === 'CLASS') {
      throw forbidden(
        'Teachers can post to a specific section. Ask an administrator to post to every section of a class.'
      );
    }
    const teaches = await prisma.subject.findFirst({
      where: { classId: klass.id, teacherId: user.id },
      select: { id: true },
    });
    if (!teaches) throw forbidden('You can only post notices to classes you teach.');
  }

  if (targetType === 'SECTION') {
    return {
      targetType,
      targetClassId: klass.id,
      targetClassName: null,
      targetAcademicYear: null,
    };
  }

  // CLASS: every section sharing this name in this academic year.
  return {
    targetType,
    targetClassId: null,
    targetClassName: klass.name,
    targetAcademicYear: klass.academicYear,
  };
}

/**
 * How many students a target actually reaches.
 *
 * Returned on create so the UI can confirm "posted to Section B — 2 students".
 * Mis-targeting a notice at the wrong section is easy (the same class name
 * exists in several sections) and otherwise silent, so it's worth the query.
 */
async function countRecipients(target) {
  if (target.targetType === 'ALL') {
    return prisma.user.count({ where: { role: 'STUDENT', isActive: true } });
  }

  if (target.targetType === 'SECTION') {
    return prisma.enrollment.count({ where: { classId: target.targetClassId } });
  }

  return prisma.enrollment.count({
    where: {
      class: { name: target.targetClassName, academicYear: target.targetAcademicYear },
    },
  });
}

export async function createNotice(user, data, file) {
  const target = await resolveTarget(user, data);

  let stored = null;
  if (file) {
    stored = await storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      folder: 'notices',
    });
  }

  const notice = await prisma.notice.create({
    data: {
      title: data.title,
      body: data.body,
      ...target,
      fileUrl: stored?.key ?? null,
      fileName: stored?.fileName ?? null,
      postedById: user.id,
    },
    select: noticeSelect,
  });

  return { ...publicNotice(notice), recipientCount: await countRecipients(target) };
}

export async function updateNotice(user, noticeId, data, file) {
  const existing = await loadForAuthor(user, noticeId);

  // Re-check permission if the audience is being changed.
  const target =
    data.targetType || data.targetClassId
      ? await resolveTarget(user, {
          targetType: data.targetType ?? existing.targetType,
          targetClassId: data.targetClassId ?? existing.targetClassId,
        })
      : {};

  let fileUrl = existing.fileUrl;
  let fileName = existing.fileName;

  if (file) {
    const stored = await storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      folder: 'notices',
    });
    fileUrl = stored.key;
    fileName = stored.fileName;
    if (existing.fileUrl) await storage.remove(existing.fileUrl);
  } else if (data.removeFile && existing.fileUrl) {
    await storage.remove(existing.fileUrl);
    fileUrl = null;
    fileName = null;
  }

  const notice = await prisma.notice.update({
    where: { id: noticeId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...target,
      fileUrl,
      fileName,
    },
    select: noticeSelect,
  });

  return publicNotice(notice);
}

export async function deleteNotice(user, noticeId) {
  const existing = await loadForAuthor(user, noticeId);

  await prisma.notice.delete({ where: { id: noticeId } });
  if (existing.fileUrl) await storage.remove(existing.fileUrl);
}

/** A notice may only be edited or deleted by its author, or by an admin. */
async function loadForAuthor(user, noticeId) {
  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      postedById: true,
      fileUrl: true,
      fileName: true,
      targetType: true,
      targetClassId: true,
    },
  });
  if (!notice) throw notFound('That notice does not exist.');

  if (user.role !== 'ADMIN' && notice.postedById !== user.id) {
    throw forbidden('You can only change notices you posted yourself.');
  }

  return notice;
}

/* ========================================================================== */
/* Attachment download                                                        */
/* ========================================================================== */

export async function readNoticeFile(user, noticeId) {
  // getNotice enforces the same audience rule as the feed.
  const notice = await getNotice(user, noticeId);
  if (!notice.hasFile) throw notFound('That notice has no attachment.');

  const stored = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { fileUrl: true, fileName: true },
  });

  return { buffer: await storage.read(stored.fileUrl), fileName: stored.fileName };
}

/* ========================================================================== */
/* Helper for the compose form                                                */
/* ========================================================================== */

/**
 * Classes this user may address, for the audience picker.
 * Admins get every class; teachers get only the ones they teach in.
 */
export async function targetableClasses(user) {
  const where =
    user.role === 'ADMIN' ? {} : { subjects: { some: { teacherId: user.id } } };

  const classes = await prisma.class.findMany({
    where,
    select: {
      id: true,
      name: true,
      section: true,
      academicYear: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }, { section: 'asc' }],
  });

  return {
    canPostCollegeWide: user.role === 'ADMIN',
    canPostWholeClass: user.role === 'ADMIN',
    // Lets the compose form say "reaches N students" before anything is posted.
    totalStudents: await prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      academicYear: c.academicYear,
      studentCount: c._count.enrollments,
    })),
  };
}
