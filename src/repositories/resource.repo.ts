import { Model, Types } from 'mongoose';
import Resource from '../models/Resource';
import { IResource } from '../models/types';

export class ResourceRepository {
  private model: Model<IResource>;

  constructor() {
    this.model = Resource;
  }

  async findWithPagination(query: any, options: {
    page: number;
    limit: number;
    sort?: any;
    populate?: any;
  }) {
    const skip = (options.page - 1) * options.limit;
    
    const [docs, total] = await Promise.all([
      this.model.find(query)
        .sort(options.sort)
        .skip(skip)
        .limit(options.limit)
        .populate(options.populate),
      this.model.countDocuments(query)
    ]);

    return {
      docs,
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.ceil(total / options.limit)
    };
  }

  async findById(id: string): Promise<IResource | null> {
    return this.model.findById(id);
  }

  async findByCommunity(communityId: Types.ObjectId): Promise<IResource[]> {
    return this.model.find({ community: communityId });
  }

  async create(data: Partial<IResource>): Promise<IResource> {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<IResource>): Promise<IResource | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}