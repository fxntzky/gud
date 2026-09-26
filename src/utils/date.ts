import type { NewsEdition } from '../types/news';
import { editionLocale } from '../config/copy';

const safeDate = (value: string | Date): Date => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const dateKeyToUtcDate = (value: string): Date =>
  safeDate(`${value}T12:00:00.000Z`);

export const getUtcEditionKey = (value: Date = new Date()): string =>
  value.toISOString().slice(0, 10);

export const formatDate = (
  value: string,
  edition: NewsEdition = 'english',
): string =>
  new Intl.DateTimeFormat(editionLocale[edition], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(safeDate(value));

export const formatEditionDate = (
  editionDate?: string,
  edition: NewsEdition = 'english',
): string => {
  const date = editionDate ? dateKeyToUtcDate(editionDate) : new Date();

  return new Intl.DateTimeFormat(editionLocale[edition], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase();
};

export const formatRelativeTime = (
  value: string,
  edition: NewsEdition = 'english',
): string => {
  const date = safeDate(value);
  const deltaMs = date.getTime() - Date.now();
  const deltaMinutes = Math.round(deltaMs / 60_000);

  if (Math.abs(deltaMinutes) < 1) {
    return edition === 'latam' ? 'AHORA' : 'JUST NOW';
  }

  const formatter = new Intl.RelativeTimeFormat(editionLocale[edition], {
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

export const formatUpdatedAt = (
  value?: string,
  edition: NewsEdition = 'english',
): string => {
  if (!value) return edition === 'latam' ? 'ACTUALIZANDO' : 'UPDATING';

  const relative = formatRelativeTime(value, edition);
  return edition === 'latam' ? `ACTUALIZADO ${relative}` : `UPDATED ${relative}`;
};
