/**
 * ---------------------------------------------------------------------------
 * PARENT CHILD SWITCHER
 * ---------------------------------------------------------------------------
 *
 * A parent linked to several students picks which one they're looking at.
 *
 * The choice is kept in sessionStorage so it survives moving between the
 * attendance, assignments and results pages — a parent shouldn't have to
 * re-pick their child on every screen. It resets when the tab closes.
 */
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Card, cx } from './ui.jsx';

const STORAGE_KEY = 'college-portal.selectedChildId';

/**
 * Returns the parent's children and which one is selected.
 *
 * @returns {{ children: any[], selected: any|null, setSelectedId: (id: string) => void }}
 */
export function useSelectedChild() {
  const { context } = useAuth();
  const children = context.children ?? [];

  const [selectedId, setSelectedIdState] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Private browsing modes can throw on storage access.
      return null;
    }
  });

  // Fall back to the first child if the stored id is stale (e.g. the link was
  // removed by an admin since the last visit).
  const selected = children.find((c) => c.id === selectedId) ?? children[0] ?? null;

  function setSelectedId(id) {
    setSelectedIdState(id);
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not being able to remember the choice is not worth breaking the page.
    }
  }

  return { children, selected, setSelectedId };
}

/**
 * Renders nothing when there's only one child — no point offering a choice.
 *
 * The list prop is called `options`, not `children`: `children` is a reserved
 * React prop, and using it here would break the moment someone nested content
 * inside this component.
 */
export function ChildSwitcher({ options, selected, onSelect }) {
  if (options.length <= 1) return null;

  return (
    <Card title="Viewing" bodyClassName="py-3" className="mb-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select a child">
        {options.map((child) => {
          const active = child.id === selected?.id;
          return (
            <button
              key={child.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(child.id)}
              className={cx(
                'min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
              )}
            >
              {child.name}
              {child.rollNo && (
                <span className={cx('ml-2 text-xs', active ? 'text-brand-100' : 'text-slate-400')}>
                  {child.rollNo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
