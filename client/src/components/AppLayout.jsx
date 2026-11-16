/**
 * ---------------------------------------------------------------------------
 * APP SHELL — top bar + navigation, wrapped around every logged-in page.
 * ---------------------------------------------------------------------------
 *
 * Responsive strategy:
 *   phone   : top bar with a hamburger that opens a slide-over drawer
 *   desktop : permanent sidebar on the left (lg: and up)
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { Badge, Button, cx } from './ui.jsx';

/**
 * Navigation per role. Later phases add entries here — one place to edit.
 * `end: true` means the link is only active on an exact path match.
 */
const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/classes', label: 'Classes & subjects' },
    { to: '/admin/users', label: 'Students & parents' },
    { to: '/admin/assignments', label: 'All assignments' },
    { to: '/admin/notices', label: 'Notices', badge: 'notices' },
    { to: '/admin/results', label: 'Results' },
    { to: '/admin/oversight', label: 'Teachers & activity' },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Dashboard', end: true },
    { to: '/teacher/attendance', label: 'Mark attendance' },
    { to: '/teacher/assignments', label: 'Assignments' },
    { to: '/teacher/notices', label: 'Notices', badge: 'notices' },
    { to: '/teacher/results', label: 'Results' },
    { to: '/teacher/reports', label: 'Attendance reports' },
  ],
  STUDENT: [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/student/attendance', label: 'My attendance' },
    { to: '/student/assignments', label: 'Assignments' },
    { to: '/student/notices', label: 'Notices', badge: 'notices' },
    { to: '/student/results', label: 'My results' },
  ],
  PARENT: [
    { to: '/parent', label: 'Dashboard', end: true },
    { to: '/parent/attendance', label: 'Attendance' },
    { to: '/parent/assignments', label: 'Assignments' },
    { to: '/parent/notices', label: 'Notices', badge: 'notices' },
    { to: '/parent/results', label: 'Results' },
  ],
};

const ROLE_LABEL = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const navItems = NAV_BY_ROLE[user?.role] ?? [];

  /**
   * Unread notice count for the nav badge. Re-fetched on every navigation,
   * which is enough to keep it current without polling.
   */
  const [unreadNotices, setUnreadNotices] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/notices/unread-count')
      .then((data) => {
        if (!cancelled) setUnreadNotices(data.unread ?? 0);
      })
      .catch(() => {
        // A missing badge is not worth surfacing an error for.
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const badgeCounts = { notices: unreadNotices };

  const closeDrawer = () => setDrawerOpen(false);

  // Close the mobile drawer on any navigation, including browser back/forward.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-30 bg-brand-800 text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
          {/* Hamburger: only on small screens, and only if there's more than
              one destination to navigate to. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-lg p-2 hover:bg-white/10 lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <MenuIcon />
          </button>

          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-white/15 text-xs">CP</span>
            <span className="hidden sm:inline">Campus Connect</span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-brand-200">{ROLE_LABEL[user?.role] ?? user?.role}</p>
            </div>
            <Link
              to="/change-password"
              className="rounded-lg px-2 py-1.5 text-xs text-brand-100 hover:bg-white/10"
            >
              Password
            </Link>
            <Button variant="inverse" onClick={logout} className="px-3">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 sm:px-6 sm:py-6">
        {/* ---------------- Desktop sidebar ---------------- */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {navItems.map((item) => (
              <SidebarLink key={item.to} item={item} counts={badgeCounts} />
            ))}
          </nav>
        </aside>

        {/* ---------------- Page content ---------------- */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* ---------------- Mobile drawer ---------------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Click-away backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <Badge tone="brand" className="mt-1">
                  {ROLE_LABEL[user?.role] ?? user?.role}
                </Badge>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation menu"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="space-y-1" onClick={closeDrawer}>
              {navItems.map((item) => (
                <SidebarLink key={item.to} item={item} counts={badgeCounts} />
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

/** A single nav link, styled to show the active route, with an optional count. */
function SidebarLink({ item, counts = {} }) {
  const count = item.badge ? (counts[item.badge] ?? 0) : 0;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
        )
      }
    >
      <span>{item.label}</span>
      {count > 0 && (
        <span className="min-w-5 rounded-full bg-brand-600 px-1.5 py-0.5 text-center text-xs font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

/** Standard page heading, used by every page for a consistent look. */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
