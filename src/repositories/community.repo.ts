import { ICommunity } from '../models/Community';
import Community from '../models/Community';

export class CommunityRepository {
  async create(community: Partial<ICommunity>): Promise<ICommunity> {
    return Community.create(community);
  }

  async findAll(): Promise<ICommunity[]> {
    return Community.find().exec();
  }

  async findById(id: string): Promise<ICommunity | null> {
    return Community.findById(id).exec();
  }

  async update(id: string, community: Partial<ICommunity>): Promise<ICommunity | null> {
    return Community.findByIdAndUpdate(id, community, { new: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await Community.findByIdAndDelete(id).exec();
  }

  async joinCommunity(communityId: string, userId: string): Promise<ICommunity | null> {
    return Community.findByIdAndUpdate(
      communityId,
      { $addToSet: { members: { userId } } },
      { new: true }
    ).exec();
  }
}