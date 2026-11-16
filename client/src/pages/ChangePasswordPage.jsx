/**
 * Change-your-own-password screen.
 *
 * Doubles as the forced-change screen: when an admin resets someone's password
 * the account gets `mustChangePassword = true`, and ProtectedRoute redirects
 * here until it's done.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../auth/AuthContext.jsx';
import { api, ApiError } from '../api/client.js';
import { Alert, Button, Card, Field } from '../components/ui.jsx';
import { PageHeader } from '../components/AppLayout.jsx';

export function ChangePasswordPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const forced = Boolean(user?.mustChangePassword);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      await api.post('/auth/change-password', form);
      // Pull fresh user data so mustChangePassword flips to false.
      const updated = await refresh();
      navigate(HOME_BY_ROLE[updated.role] ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Change password"
        subtitle={forced ? undefined : 'Choose a password you do not use anywhere else.'}
      />

      {forced && (
        <Alert tone="warning" title="Please set a new password" className="mb-4">
          Your password was reset by the college office. Set your own password to continue.
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            error={fieldErrors.currentPassword}
            required
          />

          <Field
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            value={form.newPassword}
            onChange={update('newPassword')}
            error={fieldErrors.newPassword}
            required
          />

          <Field
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={fieldErrors.confirmPassword}
            required
          />

          <div className="flex gap-2">
            <Button type="submit" loading={submitting}>
              Update password
            </Button>
            {!forced && (
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
