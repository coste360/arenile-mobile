import { useEffect, useState } from 'react';

/**
 * `value` once it has stayed the same for `ms` (the first value at once):
 * a burst of changes, such as taps on a stepper, settles into one.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
