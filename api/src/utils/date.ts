const safeDate = (value: string | Date): Date => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const dateKeyToUtcDate = (value: string): Date =>
  safeDate(`${value}T12:00:00.000Z`);

export const getUtcEditionKey = (value: Date = new Date()): string =>
  value.toISOString().slice(0, 10);

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(safeDate(value));

export const formatEditionDate = (editionDate?: string): string => {
  const date = editionDate ? dateKeyToUtcDate(editionDate) : new Date();

  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase();
};

export const formatRelativeTime = (value: string): string => {
  const date = safeDate(value);
  const deltaMs = date.getTime() - Date.now();
  const deltaMinutes = Math.round(deltaMs / 60_000);

  if (Math.abs(deltaMinutes) < 1) return 'JUST NOW';

  const formatter = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
    style: 'short',
  });

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, 'minute').toUpperCase();
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, 'hour').toUpperCase();
  }

  const deltaDays = Math.round(deltaHours / 24);
  return formatter.format(deltaDays, 'day').toUpperCase();
};

export const formatUpdatedAt = (value?: string): string => {
  if (!value) return 'UPDATING';
  return `UPDATED ${formatRelativeTime(value)}`;
};
