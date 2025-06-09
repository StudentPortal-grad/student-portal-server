import { Types } from 'mongoose';
import { ICommunity } from '../models/types';
import Community from '../models/Community';
import { PaginationOptions } from '../utils/pagination';
import { DbOperations } from '../utils/dbOperations';

export class CommunityRepository {
  async create(community: Partial<ICommunity>): Promise<ICommunity> {
    return DbOperations.create(Community, community);
  }

  async findAllPaginated(options: PaginationOptions) {
    return DbOperations.paginate(Community, {}, options);
  }

  async findById(id: string): Promise<ICommunity | null> {
    return DbOperations.findOne(Community, { _id: id });
  }

  async update(id: string, community: Partial<ICommunity>): Promise<ICommunity | null> {
    return DbOperations.updateOne(Community, { _id: id }, community);
  }

  async delete(id: string): Promise<void> {
    await DbOperations.deleteOne(Community, { _id: id });
  }

  async joinCommunity(communityId: string, userId: string): Promise<ICommunity | null> {
    return DbOperations.updateOne(
      Community,
      { _id: communityId },
      {
        $addToSet: {
          members: {
            userId: new Types.ObjectId(userId),
            roleIds: [],
            joinedAt: new Date()
          }
        }
      }
    );
  }

  async findMembersPaginated(communityId: string, options: PaginationOptions) {
    return DbOperations.paginate(
      Community,
      { _id: communityId },
      {
        ...options,
        populate: {
          path: 'members.userId',
          select: 'name email profilePicture'
        }
      }
    );
  }

  async findCommunityRoles(communityId: string) {
    const community = await Community.findById(communityId)
      .populate('roles')
      .select('roles')
      .lean();
    return community?.roles || [];
  }

  async getMetrics() {
    const [total, official, user] = await Promise.all([
      Community.countDocuments(),
      Community.countDocuments({ type: 'Official' }),
      Community.countDocuments({ type: 'Community' })
    ]);
    return {
      totalCommunities: total,
      officialCommunities: official,
      userCommunities: user
    };
  }
}