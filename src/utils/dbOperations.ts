import {
  Model,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  PopulateOptions,
  Document,
} from 'mongoose';
import { AppError, ErrorCodes } from './appError';
import { PaginationOptions, getPaginationMetadata } from './pagination';

type PopulateField = {
  path: string;
  select?: string[] | Record<string, number>;
  populate?: PopulateField | PopulateField[];
};

/**
 * Generic database operations with TypeScript support and error handling
 */
export class DbOperations {
  static async create<T>(model: Model<T>, data: Partial<T>): Promise<T>;
  static async create<T>(model: Model<T>, data: Partial<T>[]): Promise<T[]>;

  /**
   * Create one or more documents
   * @example
   * // Create single document
   * const user = await DbOperations.create(User, { name: 'John' });
   *
   * // Create multiple documents
   * const users = await DbOperations.create(User, [{ name: 'John' }, { name: 'Jane' }]);
   *
   * // Create with options
   * const users = await DbOperations.create(User, [{ name: 'John' }], { session });
   */
  static async create<T>(
    model: Model<T>,
    data: Partial<T> | Partial<T>[]
  ): Promise<T | T[]> {
    try {
      if (Array.isArray(data)) {
        return (await model.create(data)) as T[];
      }
      return (await model.create(data)) as T;
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find and update a single document
   */
  static async updateOne<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    try {
      const result = await model.findOneAndUpdate(filter, update, options);
      return result;
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find and delete a single document
   */
  static async deleteOne<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: QueryOptions = {}
  ): Promise<T | null> {
    try {
      return await model.findOneAndDelete(filter, options);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Update many documents
   */
  static async updateMany<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<number> {
    try {
      const result = await model.updateMany(filter, update);
      return result.modifiedCount;
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Delete many documents
   */
  static async deleteMany<T>(
    model: Model<T>,
    filter: FilterQuery<T>
  ): Promise<number> {
    try {
      const result = await model.deleteMany(filter);
      return result.deletedCount;
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find a single document
   */
  static async findOne<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    projection: any = {}
  ): Promise<T | null> {
    try {
      return await model.findOne(filter, projection);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find a single document
   */
  static async findOneWithSelect<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    projection: string = ''
  ): Promise<T | null> {
    try {
      return await model.findOne(filter).select(projection);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find multiple documents
   */
  static async findMany<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    projection: any = {}
  ): Promise<T[]> {
    try {
      return await model.find(filter, projection);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Count documents
   */
  static async count<T>(
    model: Model<T>,
    filter: FilterQuery<T>
  ): Promise<number> {
    try {
      return await model.countDocuments(filter);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find documents with pagination
   */
  static async paginate<T extends Document>(
    model: Model<T>,
    query: Record<string, any>,
    options: PaginationOptions
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = model.find(query);

    if (options.populate) {
      queryBuilder.populate(options.populate);
    }

    if (options.select) {
      queryBuilder.select(options.select);
    }

    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      queryBuilder.sort({ [options.sortBy]: sortOrder });
    }

    const [results, total] = await Promise.all([
      queryBuilder.skip(skip).limit(limit).exec(),
      model.countDocuments(query),
    ]);

    return {
      docs: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  /**
   * Find documents with field selection
   * @example
   * // Only return name and email fields
   * const users = await DbOperations.select(User, {}, ['name', 'email']);
   * // Exclude password field
   * const users = await DbOperations.select(User, {}, ['-password']);
   */
  static async select<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    fields: string[] | Record<string, number>,
    options: QueryOptions = {}
  ): Promise<T[]> {
    try {
      const projection = Array.isArray(fields)
        ? fields.join(' ')
        : Object.entries(fields).reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, number>);

      return await model.find(filter).select(projection).setOptions(options);
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Find documents with advanced filtering
   * @example
   * // Filter users by age range and active status
   * const filters = {
   *   age: { $gte: 18, $lte: 30 },
   *   isActive: true,
   *   role: { $in: ['student', 'teacher'] }
   * };
   * const users = await DbOperations.filter(User, filters);
   */
  static async filter<T>(
    model: Model<T>,
    filters: FilterQuery<T>,
    options: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
      select?: string[] | Record<string, number>;
    } = {}
  ): Promise<T[]> {
    try {
      let query = model.find(filters);

      if (options.sort) {
        query = query.sort(options.sort);
      }
      if (options.select) {
        const projection = Array.isArray(options.select)
          ? options.select.join(' ')
          : options.select;
        query = query.select(projection);
      }
      if (options.skip) {
        query = query.skip(options.skip);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      return await query.exec();
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Populate specific fields with selected sub-fields
   * @example
   * // Populate single field with specific sub-fields
   * const post = await DbOperations.populate(Post, postId, {
   *   path: 'author',
   *   select: ['name', 'email']
   * });
   *
   * // Populate multiple fields
   * const post = await DbOperations.populate(Post, postId, [
   *   {
   *     path: 'author',
   *     select: ['name', 'avatar']
   *   },
   *   {
   *     path: 'comments',
   *     select: ['content', 'createdAt'],
   *     populate: {
   *       path: 'author',
   *       select: ['name']
   *     }
   *   }
   * ]);
   *
   * // Populate field in multiple documents
   * const posts = await DbOperations.populate(Post, posts, {
   *   path: 'author',
   *   select: ['name', 'email']
   * });
   */
  static async populate<T>(
    model: Model<T>,
    docs: T | T[] | string | string[],
    populateOptions: PopulateField | PopulateField[]
  ): Promise<T | T[]> {
    try {
      // Convert single populate option to array
      const populateFields = Array.isArray(populateOptions)
        ? populateOptions
        : [populateOptions];

      // Prepare populate configuration
      const populateConfig = populateFields.map((field) => {
        const config: PopulateOptions = { path: field.path };

        // Add field selection if specified
        if (field.select) {
          config.select = Array.isArray(field.select)
            ? field.select.join(' ')
            : Object.entries(field.select)
                .map(([key, value]) => (value ? key : `-${key}`))
                .join(' ');
        }

        // Handle nested populates
        if (field.populate) {
          config.populate = Array.isArray(field.populate)
            ? field.populate.map((p) => this.convertToPopulateOptions(p))
            : this.convertToPopulateOptions(field.populate);
        }

        return config;
      });

      // Handle different input types
      const documents =
        typeof docs === 'string' ||
        (Array.isArray(docs) && typeof docs[0] === 'string')
          ? await model.find({
              _id: Array.isArray(docs) ? { $in: docs } : docs,
            })
          : (docs as T | T[]);

      // Perform population
      const populated = await model.populate(documents, populateConfig);

      // Return single document or array based on input type
      return Array.isArray(documents)
        ? populated
        : Array.isArray(populated)
        ? populated[0]
        : populated;
    } catch (error) {
      throw new AppError(
        'Population operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  private static convertToPopulateOptions(
    field: PopulateField
  ): PopulateOptions {
    const config: PopulateOptions = { path: field.path };

    if (field.select) {
      config.select = Array.isArray(field.select)
        ? field.select.join(' ')
        : Object.entries(field.select)
            .map(([key, value]) => (value ? key : `-${key}`))
            .join(' ');
    }

    if (field.populate) {
      config.populate = Array.isArray(field.populate)
        ? field.populate.map((p) => this.convertToPopulateOptions(p))
        : this.convertToPopulateOptions(field.populate);
    }

    return config;
  }

  /**
   * Update an existing document directly without querying
   * @example
   * // Update user document directly
   * const updatedUser = await DbOperations.updateDocument(userDoc, { name: 'John' });
   */
  static async updateDocument<T extends Document>(
    doc: T,
    update: UpdateQuery<T>,
    options: QueryOptions = { new: true, runValidators: true }
  ): Promise<T> {
    try {
      Object.assign(doc, update);
      if (options.runValidators === false) {
        return await doc.save({ validateBeforeSave: false });
      }
      return await doc.save();
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Delete an existing document directly without querying
   */
  static async deleteDocument<T extends Document>(doc: T): Promise<T> {
    try {
      return await doc.deleteOne();
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  /**
   * Save document with option to skip validation
   */
  static async saveDocument<T extends Document>(
    doc: T,
    skipValidation: boolean = false
  ): Promise<T> {
    try {
      if (skipValidation) {
        return await doc.save({ validateBeforeSave: false });
      }
      return await doc.save();
    } catch (error) {
      throw new AppError(
        'Database operation failed',
        500,
        ErrorCodes.DB_ERROR,
        error
      );
    }
  }

  static async findWithPagination<T>(
    model: Model<T>,
    query: FilterQuery<T>,
    options: PaginationOptions
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = model.find(query);

    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      queryBuilder.sort({ [options.sortBy]: sortOrder });
    }

    if (options.select) {
      queryBuilder.select(options.select);
    }

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(p => {
          queryBuilder.populate(p);
        });
      } else {
        queryBuilder.populate(options.populate);
      }
    }

    const [data, total] = await Promise.all([
      queryBuilder.skip(skip).limit(limit).exec(),
      model.countDocuments(query),
    ]);

    return {
      data,
      pagination: getPaginationMetadata(total, {
        ...options,
        page,
        limit,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
      }),
    };
  }
}
