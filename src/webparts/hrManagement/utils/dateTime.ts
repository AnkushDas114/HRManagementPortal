const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value: Date | string | number): Date => {
  if (value instanceof Date) return value;

  const stringValue = String(value);
  if (dateOnlyPattern.test(stringValue)) {
    const [year, month, day] = stringValue.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  return new Date(value);
};

export const getNowIST = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: IST_TIME_ZONE }));
};

export const formatDateIST = (value: Date | string | number | undefined): string => {
  if (value === undefined || value === '') return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

export const todayIST = (): string => {
  return formatDateIST(getNowIST());
};

export const formatDateForDisplayIST = (
  value: Date | string | number | undefined,
  locale = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string => {
  if (value === undefined || value === '') return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale, {
    timeZone: IST_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }).format(date);
};

export const monthNameIST = (locale = 'en-US'): string => {
  return new Intl.DateTimeFormat(locale, { timeZone: IST_TIME_ZONE, month: 'long' }).format(getNowIST());
};

export const nowISTISOString = (): string => {
  const now = getNowIST();
  const datePart = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  return `${datePart}T${timePart}${IST_OFFSET}`;
};
