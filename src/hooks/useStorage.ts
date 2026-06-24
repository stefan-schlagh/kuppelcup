import { useState, useEffect, useCallback } from "react";

// Define an interface for the custom window.storage API if it exists globally
interface CustomStorageAPI {
  get: (key: string, optionalFlag?: boolean) => Promise<{ value: string | null }>;
  set: (key: string, value: string, optionalFlag?: boolean) => Promise<void>;
}

// Extend the global Window interface safely
declare global {
  interface Window {
    storage?: CustomStorageAPI;
  }
}

export function useStorage<T>(key: string, initial: T): [T, (next: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState<boolean>(false);

  // Helper to extract the proper storage engine safely
  const getStorageAPI = (): CustomStorageAPI => {
    return window.storage || {
      get: async (k: string) => ({ value: localStorage.getItem(k) }),
      set: async (k: string, v: string) => localStorage.setItem(k, v)
    };
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const storageAPI = getStorageAPI();
        const res = await storageAPI.get(key, true);
        
        if (mounted && res && res.value) {
          setValue(JSON.parse(res.value) as T);
        }
      } catch (e) {
        // key not found yet or parsing failed -> keep initial state value
      } finally {
        if (mounted) setLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [key]);

  const persist = useCallback(async (next: T) => {
    setValue(next);
    try {
      const storageAPI = getStorageAPI();
      await storageAPI.set(key, JSON.stringify(next), true);
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, [key]);

  return [value, persist, loaded];
}