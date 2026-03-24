export type OffsetPaginationQuery = {
  limit: number;
  offset: number;
};

export const buildOffsetPage = <T>(
  items: T[],
  total: number,
  pagination: OffsetPaginationQuery
) => ({
  items,
  total,
  limit: pagination.limit,
  offset: pagination.offset,
  hasMore: pagination.offset + items.length < total
});

export const buildCursorPage = <T extends { id: string }>(results: T[], limit: number) => {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? items[items.length - 1]!.id : null;
  return { items, nextCursor };
};

export const cursorWhere = (cursor: string | undefined) =>
  cursor ? { id: { lt: cursor } } : {};
