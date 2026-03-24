export const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const csvValue = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return csvEscape(String(value));
};

export const buildCsvRow = (values: (string | number | boolean | null | undefined)[]): string =>
  values.map(csvValue).join(",");

export const buildCsv = (headers: string[], rows: (string | number | boolean | null | undefined)[][]): string => [
  headers.map(csvEscape).join(","),
  ...rows.map(buildCsvRow)
].join("\n");
