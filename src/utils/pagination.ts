export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getPaginationOptions = (query: any): PaginationOptions => {
  return {
    page: Math.max(1, parseInt(query.page) || 1),
    limit: Math.max(1, Math.min(parseInt(query.limit) || 10, 100)),
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc'
  };
};

export const getPaginationMetadata = (
  total: number,
  options: PaginationOptions
) => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}; 