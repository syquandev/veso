import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for localStorage persistence with automatic save/load.
 * Prevents race conditions by debouncing saves and using refs.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const valueRef = useRef(storedValue);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      valueRef.current = newValue;
      return newValue;
    });
  }, []);

  // Save to localStorage when value changes - debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error saving to localStorage key "${key}":`, error);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [key, storedValue]);

  return [storedValue, setValue];
}
