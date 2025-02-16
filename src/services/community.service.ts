import { CommunityRepository } from '../repositories/community.repo';
import { ICommunity } from '../models/Community';

export class CommunityService {
  private communityRepository: CommunityRepository;

  constructor() {
    this.communityRepository = new CommunityRepository();
  }

  async createCommunity(community: Partial<ICommunity>): Promise<ICommunity> {
    return this.communityRepository.create(community);
  }

  async getAllCommunities(): Promise<ICommunity[]> {
    return this.communityRepository.findAll();
  }

  async getCommunityById(id: string): Promise<ICommunity | null> {
    return this.communityRepository.findById(id);
  }

  async joinCommunity(communityId: string, userId: string): Promise<ICommunity | null> {
    return this.communityRepository.joinCommunity(communityId, userId);
  }
}