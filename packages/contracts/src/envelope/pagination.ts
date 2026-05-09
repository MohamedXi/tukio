export interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
  totalEstimate: number | null;
  limit: number;
}
