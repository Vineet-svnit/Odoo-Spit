export function getTimestampMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const withToMillis = value as { toMillis?: () => number };

  if (typeof withToMillis.toMillis === "function") {
    return withToMillis.toMillis();
  }

  const withSeconds = value as { _seconds?: number; seconds?: number };
  const seconds = withSeconds._seconds ?? withSeconds.seconds;

  if (typeof seconds === "number") {
    return seconds * 1000;
  }

  return null;
}

export function formatFirebaseDate(value: unknown, fallback = "-"): string {
  const millis = getTimestampMillis(value);

  if (millis === null) {
    return fallback;
  }

  return new Date(millis).toLocaleDateString();
}

export function formatFirebaseDateTime(value: unknown, fallback = "-"): string {
  const millis = getTimestampMillis(value);

  if (millis === null) {
    return fallback;
  }

  return new Date(millis).toLocaleString();
}
