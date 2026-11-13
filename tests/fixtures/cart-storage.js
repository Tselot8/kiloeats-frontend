// Isolated browser harnesses use their own cart storage, never the normal key.
const values = new Map();
export const getFixtureCartStorage = () => ({
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
});
