/** Small standalone pages for the two things that can go wrong in routing. */
import { Link } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../auth/AuthContext.jsx';
import { buttonClasses } from '../components/ui.jsx';

/** Shown when a logged-in user reaches a route their role may not see. */
export function UnauthorizedPage() {
  const { user } = useAuth();
  const home = HOME_BY_ROLE[user?.role] ?? '/';

  return (
    <CentredMessage
      code="403"
      title="You do not have access to that page"
      message="Your account role does not permit it. If you think this is a mistake, contact the college office."
      to={home}
      linkLabel="Back to my dashboard"
    />
  );
}

export function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? (HOME_BY_ROLE[user.role] ?? '/') : '/login';

  return (
    <CentredMessage
      code="404"
      title="Page not found"
      message="The page you were looking for does not exist or has moved."
      to={home}
      linkLabel={user ? 'Back to my dashboard' : 'Go to login'}
    />
  );
}

function CentredMessage({ code, title, message, to, linkLabel }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold tracking-widest text-brand-600">{code}</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
      {/* Styled as a button but rendered as a link — a <button> inside an <a>
          would be invalid HTML and confusing for screen readers. */}
      <Link to={to} className={buttonClasses('primary', 'mt-6')}>
        {linkLabel}
      </Link>
    </div>
  );
}
