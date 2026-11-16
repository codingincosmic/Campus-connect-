/**
 * Login screen — the only public page in the app.
 *
 * There is no "sign up" link on purpose: the college creates all accounts, so
 * students and parents cannot self-register.
 */
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../auth/AuthContext.jsx';
import { ApiError } from '../api/client.js';
import { Alert, Button, Field } from '../components/ui.jsx';
import { FullPageSpinner } from '../components/Spinner.jsx';

export function LoginPage() {
  const { login, user, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (initializing) return <FullPageSpinner label="Checking your session..." />;

  // Already logged in? Don't show the form again.
  if (user) return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    // Clear that field's error as soon as the user starts fixing it.
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      const loggedIn = await login(form.identifier, form.password);

      // Forced password change takes priority over the role dashboard.
      if (loggedIn.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      // Send them where they were originally heading, else their dashboard.
      const intended = location.state?.from;
      navigate(intended ?? HOME_BY_ROLE[loggedIn.role] ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        // Only show a banner if the error isn't already shown under a field.
        if (Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        {/* --- Brand --- */}
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-lg font-semibold text-white">
            CC
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">Campus Connect</h1>
          <p className="mt-1 text-sm text-slate-500">Attendance, assignments, notices and results</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
        >
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label="Email or username"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="e.g. bca2301 or you@college.edu"
            value={form.identifier}
            onChange={update('identifier')}
            error={fieldErrors.identifier}
            required
          />

          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={form.password}
            onChange={update('password')}
            error={fieldErrors.password}
            required
          />

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="text-center text-xs text-slate-500">
            Forgot your password? Contact the college office to have it reset.
          </p>
        </form>
      </div>
    </div>
  );
}
