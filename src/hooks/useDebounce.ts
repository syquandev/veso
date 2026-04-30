import { useState, useEffect } from 'react';

/**
 * Debounce a value - useful for search inputs and other frequently-changing values.
 * Per REFACTOR_GUIDE.md Section 6: Performance
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
