import { PaginationMetadata } from '../../utils/ApiResponse';

export {};

declare global {
  namespace Express {
    interface Response {
      /** @param data The data to send in the response */
      success<T>(data: T, message?: string, statusCode?: number): Response;
      /**
       * @param data The array of items to paginate
       * @param pagination The pagination metadata
       */
      paginated<T>(
        data: T[],
        pagination: PaginationMetadata,
        message?: string,
        statusCode?: number
      ): Response;
      /** @param message Optional error message */
      unauthorized(message?: string): Response;
      /**
       * @param message Error message
       * @param details Validation error details
       */
      validationError(message: string, details: any): Response;
      /** @param message Optional error message */
      notFound(message?: string): Response;
      /**
       * @param message Error message
       * @param details Optional error details
       */
      badRequest(message: string, details?: any): Response;
      /**
       * @param message Error message
       * @param code Error code
       * @param statusCode HTTP status code
       * @param details Optional error details
       */
      failure(
        message: string,
        code: string,
        statusCode: number,
        details?: any
      ): Response;
      /** @param message Optional error message */
      internalError(message?: string): Response;
    }
  }
}
