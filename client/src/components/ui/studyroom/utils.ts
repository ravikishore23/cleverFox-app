export function formatMMSS(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function makeId() {
  // `crypto.randomUUID` may be missing in some environments/webviews.
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
