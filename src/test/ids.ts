/** Deterministic ids for tests ("id-1", "id-2"...); the app uses random UUIDs. */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
