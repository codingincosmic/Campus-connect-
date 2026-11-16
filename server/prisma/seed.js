/**
 * ---------------------------------------------------------------------------
 * SEED SCRIPT — sample data so the app is testable the moment it starts.
 * ---------------------------------------------------------------------------
 *
 * Run with:  npm run db:seed        (from server/, or at the repo root)
 *
 * Safe to run repeatedly: everything uses `upsert`, keyed on a stable field,
 * so re-running updates the existing rows instead of creating duplicates.
 *
 * Creates one fully-populated class so there is a complete end-to-end flow:
 *   BCA Year 2 / Section A  ->  5 subjects  ->  8 students  ->  linked parents
 * plus a small Section B, which makes section-targeted notices testable.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

/** Every demo account shares this password (from SEED_PASSWORD in .env). */
const PASSWORD = env.seedPassword;
const ACADEMIC_YEAR = '2025-26';

/**
 * Create or update a user. Keyed on email so re-seeding is idempotent.
 * Note the password is re-hashed on every run — that's fine for demo data.
 */
async function upsertUser({ name, email, username, role, rollNo, phone }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, username, role, rollNo, phone, passwordHash, isActive: true },
    create: { name, email, username, role, rollNo, phone, passwordHash },
  });
}

async function main() {
  console.log('\nSeeding database...\n');

  // -------------------------------------------------------------------------
  // 1. Settings
  // -------------------------------------------------------------------------
  await prisma.appSetting.upsert({
    where: { key: 'attendanceThreshold' },
    update: {},
    create: { key: 'attendanceThreshold', value: String(env.attendanceThreshold) },
  });

  // -------------------------------------------------------------------------
  // 2. Staff
  // -------------------------------------------------------------------------
  const admin = await upsertUser({
    name: 'Dr. Meera Iyer',
    email: 'admin@college.edu',
    username: 'admin',
    role: 'ADMIN',
    phone: '9800000001',
  });

  const teacherAnita = await upsertUser({
    name: 'Prof. Anita Rao',
    email: 'anita.rao@college.edu',
    username: 'anita',
    role: 'TEACHER',
    phone: '9800000002',
  });

  const teacherVikram = await upsertUser({
    name: 'Prof. Vikram Shah',
    email: 'vikram.shah@college.edu',
    username: 'vikram',
    role: 'TEACHER',
    phone: '9800000003',
  });

  console.log('  staff       : 1 admin, 2 teachers');

  // -------------------------------------------------------------------------
  // 3. Classes (one row = class + section)
  // -------------------------------------------------------------------------
  const classA = await prisma.class.upsert({
    where: {
      name_section_academicYear: { name: 'BCA Year 2', section: 'A', academicYear: ACADEMIC_YEAR },
    },
    update: { semester: 3 },
    create: { name: 'BCA Year 2', section: 'A', academicYear: ACADEMIC_YEAR, semester: 3 },
  });

  const classB = await prisma.class.upsert({
    where: {
      name_section_academicYear: { name: 'BCA Year 2', section: 'B', academicYear: ACADEMIC_YEAR },
    },
    update: { semester: 3 },
    create: { name: 'BCA Year 2', section: 'B', academicYear: ACADEMIC_YEAR, semester: 3 },
  });

  console.log('  classes     : BCA Year 2 / A (main), BCA Year 2 / B');

  // -------------------------------------------------------------------------
  // 4. Subjects — credits drive the SGPA/CGPA calculation
  // -------------------------------------------------------------------------
  const subjectSeeds = [
    { name: 'Data Structures', code: 'BCA301', credits: 4, teacherId: teacherAnita.id, classId: classA.id },
    { name: 'Database Systems', code: 'BCA302', credits: 4, teacherId: teacherAnita.id, classId: classA.id },
    { name: 'Mathematics III', code: 'BCA303', credits: 3, teacherId: teacherVikram.id, classId: classA.id },
    { name: 'Web Technologies', code: 'BCA304', credits: 3, teacherId: teacherVikram.id, classId: classA.id },
    { name: 'Soft Skills', code: 'BCA305', credits: 2, teacherId: teacherAnita.id, classId: classA.id },
    // Section B gets a couple of subjects so it isn't empty.
    { name: 'Data Structures', code: 'BCA301', credits: 4, teacherId: teacherVikram.id, classId: classB.id },
    { name: 'Database Systems', code: 'BCA302', credits: 4, teacherId: teacherAnita.id, classId: classB.id },
  ];

  const subjects = [];
  for (const s of subjectSeeds) {
    subjects.push(
      await prisma.subject.upsert({
        where: { classId_name: { classId: s.classId, name: s.name } },
        update: { code: s.code, credits: s.credits, teacherId: s.teacherId },
        create: s,
      })
    );
  }
  console.log(`  subjects    : ${subjects.length} (5 in Section A, 2 in Section B)`);

  // -------------------------------------------------------------------------
  // 5. Students + enrollments
  // -------------------------------------------------------------------------
  const studentSeeds = [
    { name: 'Aarav Sharma', roll: 'BCA2301', cls: classA },
    { name: 'Diya Patel', roll: 'BCA2302', cls: classA },
    { name: 'Kabir Nair', roll: 'BCA2303', cls: classA },
    { name: 'Ishita Reddy', roll: 'BCA2304', cls: classA },
    { name: 'Rohan Gupta', roll: 'BCA2305', cls: classA },
    { name: 'Ananya Singh', roll: 'BCA2306', cls: classA },
    { name: 'Vivaan Mehta', roll: 'BCA2307', cls: classA },
    { name: 'Sara Khan', roll: 'BCA2308', cls: classA },
    { name: 'Arjun Desai', roll: 'BCA2351', cls: classB },
    { name: 'Nisha Joshi', roll: 'BCA2352', cls: classB },
  ];

  const students = [];
  for (const s of studentSeeds) {
    const user = await upsertUser({
      name: s.name,
      email: `${s.roll.toLowerCase()}@student.college.edu`,
      username: s.roll.toLowerCase(),
      role: 'STUDENT',
      rollNo: s.roll,
    });

    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: user.id, classId: s.cls.id } },
      update: {},
      create: { studentId: user.id, classId: s.cls.id },
    });

    students.push(user);
  }
  console.log(`  students    : ${students.length} (enrolled)`);

  // -------------------------------------------------------------------------
  // 6. Parents + parent/student links
  //    The first parent has TWO children on purpose, so the parent
  //    child-switcher can be tested.
  // -------------------------------------------------------------------------
  const parentSeeds = [
    {
      name: 'Rajesh Sharma',
      email: 'rajesh.sharma@parent.college.edu',
      username: 'rajesh',
      relationship: 'Father',
      childRolls: ['BCA2301', 'BCA2305'], // Aarav + Rohan -> two children
    },
    {
      name: 'Sunita Patel',
      email: 'sunita.patel@parent.college.edu',
      username: 'sunita',
      relationship: 'Mother',
      childRolls: ['BCA2302'],
    },
    {
      name: 'Mohan Nair',
      email: 'mohan.nair@parent.college.edu',
      username: 'mohan',
      relationship: 'Father',
      childRolls: ['BCA2303'],
    },
  ];

  let linkCount = 0;
  for (const p of parentSeeds) {
    const parent = await upsertUser({
      name: p.name,
      email: p.email,
      username: p.username,
      role: 'PARENT',
    });

    for (const roll of p.childRolls) {
      const child = students.find((s) => s.rollNo === roll);
      if (!child) continue;
      await prisma.parentStudentLink.upsert({
        where: { parentId_studentId: { parentId: parent.id, studentId: child.id } },
        update: { relationship: p.relationship },
        create: { parentId: parent.id, studentId: child.id, relationship: p.relationship },
      });
      linkCount += 1;
    }
  }
  console.log(`  parents     : ${parentSeeds.length} (${linkCount} child links)`);

  // -------------------------------------------------------------------------
  // Summary of logins
  // -------------------------------------------------------------------------
  console.log(`
Seed complete.

  Log in with any of these — password for all: ${PASSWORD}

  ROLE     USERNAME   EMAIL
  -------  ---------  -------------------------------------
  ADMIN    admin      admin@college.edu
  TEACHER  anita      anita.rao@college.edu
  TEACHER  vikram     vikram.shah@college.edu
  STUDENT  bca2301    bca2301@student.college.edu      (Aarav Sharma)
  PARENT   rajesh     rajesh.sharma@parent.college.edu (2 children)
  PARENT   sunita     sunita.patel@parent.college.edu  (1 child)
`);
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
