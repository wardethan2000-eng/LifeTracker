export const toMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  1,
  0,
  0,
  0,
  0
));

export const getMonthRange = (start: Date, end: Date): string[] => {
  if (start > end) {
    return [];
  }

  const months: string[] = [];
  let cursor = startOfUtcMonth(start);
  const endMonth = startOfUtcMonth(end);

  while (cursor <= endMonth) {
    months.push(toMonthKey(cursor));
    cursor = addUtcMonths(cursor, 1);
  }

  return months;
};