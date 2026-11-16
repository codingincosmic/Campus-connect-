/**
 * ---------------------------------------------------------------------------
 * SHARED UI PRIMITIVES
 * ---------------------------------------------------------------------------
 *
 * A handful of small building blocks used across every page, so styling stays
 * consistent and pages stay readable. All are mobile-first: they stretch to the
 * available width and only get fancier at `sm:` and above.
 */
import { Spinner } from './Spinner.jsx';

/** Join class names, ignoring falsy values. */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  /**
   * For use on the dark brand app bar. It exists as a variant rather than being
   * patched on via `className`, because Tailwind resolves conflicting utilities
   * (bg-white vs bg-white/10) by CSS source order, not by the order you list
   * them — so overriding a variant's colour from outside is unreliable.
   */
  inverse: 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20',
};

/** Shared button geometry, also usable on an <a>/<Link> via `buttonClasses()`. */
const BUTTON_BASE =
  // min-h-11 keeps tap targets comfortable on phones (~44px).
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 ' +
  'text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Button styling for elements that must not be a <button> — chiefly react-router
 * <Link>. Putting a <button> inside an <a> is invalid HTML and confuses screen
 * readers, so links that look like buttons use this instead.
 */
export function buttonClasses(variant = 'primary', className) {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      className={buttonClasses(variant, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form field                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A labelled input with built-in error display.
 * `error` is the message string from ApiError.fieldErrors.
 */
export function Field({ label, error, hint, id, className, ...inputProps }) {
  const inputId = id ?? inputProps.name;

  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={inputId} className={className}>
      <input
        id={inputId}
        className={controlClasses(error)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...inputProps}
      />
    </FieldShell>
  );
}

/** Shared input styling, so <input>, <select> and <textarea> match exactly. */
function controlClasses(error) {
  return cx(
    // text-base (not text-sm) prevents iOS Safari zooming in on focus.
    'min-h-11 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2',
    error
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
  );
}

/** Label + error + hint wrapper shared by every form control. */
function FieldShell({ label, error, hint, htmlFor, className, children }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @param {{ options: { value: string, label: string }[], placeholder?: string }} props
 */
export function Select({ label, error, hint, id, options, placeholder, className, ...selectProps }) {
  const selectId = id ?? selectProps.name;
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={selectId} className={className}>
      <select
        id={selectId}
        className={controlClasses(error)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Textarea                                                                   */
/* -------------------------------------------------------------------------- */

export function Textarea({ label, error, hint, id, className, rows = 4, ...props }) {
  const areaId = id ?? props.name;
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={areaId} className={className}>
      <textarea
        id={areaId}
        rows={rows}
        className={cx(controlClasses(error), 'min-h-24 resize-y')}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${areaId}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Wrapper that lets a wide table scroll sideways instead of breaking the
 * layout on a phone.
 */
export function TableWrap({ children, className }) {
  return <div className={cx('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>{children}</div>;
}

export function Th({ children, className, ...props }) {
  return (
    <th
      className={cx(
        'whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }) {
  return (
    <td className={cx('px-3 py-2.5 text-sm text-slate-700', className)} {...props}>
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

export function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="min-h-9 px-3 py-1.5"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-xs text-slate-500">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          className="min-h-9 px-3 py-1.5"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                      */
/* -------------------------------------------------------------------------- */

const ALERT_TONES = {
  error: 'bg-rose-50 text-rose-800 ring-rose-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-brand-50 text-brand-800 ring-brand-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
};

export function Alert({ tone = 'info', title, children, className }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg px-4 py-3 text-sm ring-1', ALERT_TONES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ title, subtitle, action, children, className, bodyClassName }) {
  return (
    <section className={cx('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-100 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
};

export function Badge({ tone = 'slate', children, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Truncation notice                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Warns when a picker is showing only part of the matching set.
 *
 * Pickers fetch a capped page (say 100 rows). With a handful of students that
 * cap is never reached; with 2000 it silently hides people, and the user has no
 * way to know the person they want is simply off the end of the list. This says
 * so and points them at the search box.
 *
 * @param {{ shown: number, total: number, noun?: string }} props
 */
export function TruncationNotice({ shown, total, noun = 'results' }) {
  if (total <= shown) return null;

  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
      Showing the first <strong>{shown}</strong> of <strong>{total}</strong> matching {noun}. Use
      the search box above to narrow it down.
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({ title, children }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{children}</p>}
    </div>
  );
}
