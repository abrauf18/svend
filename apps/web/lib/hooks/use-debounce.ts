import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Only start the timer if the user has stopped typing
    const timer = setTimeout(() => setDebouncedValue(value), delay);

    // Cancel the timer if the value changes before the delay has passed
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
