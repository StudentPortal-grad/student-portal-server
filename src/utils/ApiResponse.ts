export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    pagination?: PaginationMetadata;
    [key: string]: any;
  };
}

export class ResponseBuilder {
  static success<T>(
    data: T,
    message = 'Operation successful',
    metadata?: Record<string, any>
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };
  }

  static paginated<T>(
    data: T[],
    {
      total = 0,
      page = 1,
      limit = 10,
      hasNextPage = false,
      hasPrevPage = false,
    }: Partial<PaginationMetadata>,
    message = 'Operation successful'
  ): ApiResponse<T[]> {
    return {
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date(),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage,
          hasPrevPage,
        },
      },
    };
  }

  static error(
    message: string,
    code: string,
    details?: any
  ): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code,
        details,
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static unauthorized(message = 'Unauthorized'): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code: 'UNAUTHORIZED',
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static validationError(message: string, details: any): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code: 'VALIDATION_ERROR',
        details,
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static notFound(message = 'Resource not found'): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code: 'NOT_FOUND',
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static badRequest(message: string, details?: any): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code: 'INVALID_INPUT',
        details,
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static failure(message: string, code: string, details?: any): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code,
        details,
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  static internalError(message = 'Internal server error'): ApiResponse<null> {
    return {
      success: false,
      message,
      error: {
        code: 'INTERNAL_ERROR',
      },
      metadata: {
        timestamp: new Date(),
      },
    };
  }
}
