// Fake network latency (300–800ms) so skeletons and optimistic states are visible.
// Only service files import this. When the backend arrives, these go away.
export function latency<T>(value: T, min = 300, max = 800): Promise<T> {
  const ms = Math.round(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}
