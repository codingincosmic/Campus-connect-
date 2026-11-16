/**
 * Shows a generated temporary password ONCE, after creating an account or
 * resetting a password.
 *
 * The plain password is never stored — it only exists in this response — so the
 * dialog is deliberately blunt about copying it before closing.
 */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Alert, Button } from './ui.jsx';

export function CredentialsDialog({ open, onClose, user, tempPassword, title = 'Account ready' }) {
  const [copied, setCopied] = useState(false);

  if (!open || !user) return null;

  const loginId = user.username || user.email;
  const summary = `Login: ${loginId}\nTemporary password: ${tempPassword}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the value is on screen to copy by hand.
      setCopied(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={user.name}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy details'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <Alert tone="warning" className="mb-3">
        This password is shown only once. Copy it now and give it to {user.name.split(' ')[0]}.
      </Alert>

      <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
        <div>
          <dt className="text-xs text-slate-500">Login with</dt>
          <dd className="font-medium text-slate-900">{loginId}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Temporary password</dt>
          {/* break-all so a long password wraps instead of overflowing on mobile */}
          <dd className="break-all font-mono text-base font-semibold text-slate-900">
            {tempPassword}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        They will be asked to choose their own password the first time they log in.
      </p>
    </Modal>
  );
}
