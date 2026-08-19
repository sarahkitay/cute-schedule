/** In-memory Web Storage for Node tests (prompt usage, app trial, social). */
export function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(i) {
      return [...store.keys()][i] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

export function installMemoryLocalStorage() {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

export function createHeaderBag(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return lower;
}
