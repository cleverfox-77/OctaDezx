// Create a single in-memory storage instance to be reused.
const memoryStorage = {
  store: new Map<string, string>(),
  getItem(key: string) {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    this.store.set(key, value);
  },
  removeItem(key: string) {
    this.store.delete(key);
  },
};

const isLocalStorageAvailable = typeof localStorage !== 'undefined';

// Custom storage implementation for Supabase.
// It attempts to use localStorage first and falls back to our in-memory storage if it fails.
export const supabaseStorage = {
  getItem: (key: string) => {
    if (isLocalStorageAvailable) {
      return localStorage.getItem(key);
    }
    return memoryStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isLocalStorageAvailable) {
      localStorage.setItem(key, value);
    } else {
      memoryStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (isLocalStorageAvailable) {
      localStorage.removeItem(key);
    } else {
      memoryStorage.removeItem(key);
    }
  },
};