/**
 * Returns a copy of `value` that only updates after the user stops changing it.
 *
 * Used for search boxes that trigger a server request: without this, typing
 * "sharma" would fire six requests instead of one.
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Each new keystroke cancels the previous pending update.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
