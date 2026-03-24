export const average = (values: number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

export const safePercent = (part: number, whole: number): number =>
  whole > 0 ? (part / whole) * 100 : 0;

export const groupBy = <T, K extends string>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> => {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
};
