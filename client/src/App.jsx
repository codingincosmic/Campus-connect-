
/**
 * ---------------------------------------------------------------------------
 * ROUTE MAP
 * ---------------------------------------------------------------------------
 *
 * Structure:
 *   /login                  public
 *   /                       redirects to the dashboard for your role
 *   /change-password        any logged-in user
 *   /admin/*                ADMIN only
 *   /teacher/*              TEACHER only
 *   /student/*              STUDENT only
 *   /parent/*               PARENT only
 *
 * Each role branch is wrapped in <ProtectedRoute allow={[...]}> so adding a
 * page in a later phase automatically inherits the right protection.
 */
import { Routes, Route } from 'react-router-dom';

import { ProtectedRoute, RoleHomeRedirect } from './auth/ProtectedRoute.jsx';
import { AppLayout } from './components/AppLayout.jsx';

import { LoginPage } from './pages/LoginPage.jsx';
import { ChangePasswordPage } from './pages/ChangePasswordPage.jsx';
import { UnauthorizedPage, NotFoundPage } from './pages/ErrorPages.jsx';
// One notices page for every role: staff can compose, students and parents
// are read-only. The server scopes the feed to each user's audience.
import { NoticesPage } from './pages/NoticesPage.jsx';

import { AdminDashboard } from './pages/admin/AdminDashboard.jsx';
import { ClassesPage } from './pages/admin/ClassesPage.jsx';
import { ClassDetailPage } from './pages/admin/ClassDetailPage.jsx';
import { UsersPage } from './pages/admin/UsersPage.jsx';
import { AdminOversightPage } from './pages/admin/AdminOversightPage.jsx';
import { AdminAssignmentsPage } from './pages/admin/AdminAssignmentsPage.jsx';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard.jsx';
import { MarkAttendancePage } from './pages/teacher/MarkAttendancePage.jsx';
import { AttendanceReportPage } from './pages/teacher/AttendanceReportPage.jsx';
import { TeacherAssignmentsPage } from './pages/teacher/TeacherAssignmentsPage.jsx';
import { GradeAssignmentPage } from './pages/teacher/GradeAssignmentPage.jsx';
import { ClassResultsPage } from './pages/teacher/ClassResultsPage.jsx';
import { StudentResultsPage } from './pages/student/StudentResultsPage.jsx';
import { ParentResultsPage } from './pages/parent/ParentResultsPage.jsx';
import { StudentDashboard } from './pages/student/StudentDashboard.jsx';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage.jsx';
import { StudentAssignmentsPage } from './pages/student/StudentAssignmentsPage.jsx';
import { ParentDashboard } from './pages/parent/ParentDashboard.jsx';
import { ParentAttendancePage } from './pages/parent/ParentAttendancePage.jsx';
import { ParentAssignmentsPage } from './pages/parent/ParentAssignmentsPage.jsx';

export default function App() {
  return (
    <Routes>
      {/* ---------------- Public ---------------- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* ---------------- Logged in, any role ---------------- */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      {/* Send each role to its own dashboard. */}
      <Route path="/" element={<RoleHomeRedirect />} />

      {/* ---------------- Admin ---------------- */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={['ADMIN']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<ClassDetailPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="results" element={<ClassResultsPage />} />
        <Route path="oversight" element={<AdminOversightPage />} />
        <Route path="assignments" element={<AdminAssignmentsPage />} />
        {/* Admins reuse the teacher's grading view to inspect submissions. */}
        <Route path="assignments/:id" element={<GradeAssignmentPage />} />
      </Route>

      {/* ---------------- Teacher ---------------- */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allow={['TEACHER']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="attendance" element={<MarkAttendancePage />} />
        <Route path="reports" element={<AttendanceReportPage />} />
        <Route path="assignments" element={<TeacherAssignmentsPage />} />
        <Route path="assignments/:id" element={<GradeAssignmentPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="results" element={<ClassResultsPage />} />
      </Route>

      {/* ---------------- Student ---------------- */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allow={['STUDENT']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="assignments" element={<StudentAssignmentsPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="results" element={<StudentResultsPage />} />
      </Route>

      {/* ---------------- Parent ---------------- */}
      <Route
        path="/parent"
        element={
          <ProtectedRoute allow={['PARENT']}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ParentDashboard />} />
        <Route path="attendance" element={<ParentAttendancePage />} />
        <Route path="assignments" element={<ParentAssignmentsPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="results" element={<ParentResultsPage />} />
      </Route>

      {/* ---------------- Fallback ---------------- */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

