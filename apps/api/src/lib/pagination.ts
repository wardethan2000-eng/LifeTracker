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