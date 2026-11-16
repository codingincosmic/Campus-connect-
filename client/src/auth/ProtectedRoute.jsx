/**
 * ---------------------------------------------------------------------------
 * ROUTE GUARDS (frontend half of RBAC)
 * ---------------------------------------------------------------------------
 *
 * IMPORTANT: these guards are for user experience, not security. They stop a
 * student from *navigating* to an admin screen; they do not stop anyone from
 * calling the API directly. The real enforcement is the backend middleware in
 * server/src/middleware/auth.js.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from './AuthContext.jsx';
import { FullPageSpinner } from '../components/Spinner.jsx';

/**
 * Wraps routes that require a logged-in user, optionally of specific roles.
 *
 * @param {{ allow?: ('ADMIN'|'TEACHER'|'STUDENT'|'PARENT')[], children?: React.ReactNode }} props
 */
export function ProtectedRoute({ allow, children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // Wait for the session check, otherwise we'd bounce a logged-in user to /login.
  if (initializing) return <FullPageSpinner label="Checking your session..." />;

  if (!user) {
    // Remember where they were headed so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // An admin reset their password: force a change before anything else.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}

/**
 * For '/' — send each role to its own dashboard.
 */
export function RoleHomeRedirect() {
  const { user, initializing } = useAuth();

  if (initializing) return <FullPageSpinner label="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={HOME_BY_ROLE[user.role] ?? '/login'} replace />;
}
