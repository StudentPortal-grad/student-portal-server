export type PaginationOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  select?: string;
  populate?: any;
};

// A more specific type for the return value of getPaginationOptions
export type ParsedPaginationOptions = Required<
  Pick<PaginationOptions, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
> & {
  select?: string;
  populate?: any;
};

export const getPaginationOptions = (query: any): ParsedPaginationOptions => {
  return {
    page: Math.max(1, parseInt(query.page) || 1),
    limit: Math.max(1, Math.min(parseInt(query.limit) || 10, 100)),
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
    select: query.select,
    populate: query.populate,
  };
};

export const getPaginationMetadata = (
  total: number,
  options: ParsedPaginationOptions
) => {
  const { page, limit } = options;
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