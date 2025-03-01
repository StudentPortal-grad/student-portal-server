import { DiscussionRepository } from '../repositories/discussion.repo';
import { IDiscussion } from '../models/Discussion';

export class DiscussionService {
  private discussionRepository: DiscussionRepository;

  constructor() {
    this.discussionRepository = new DiscussionRepository();
  }

  async createDiscussion(discussion: Partial<IDiscussion>): Promise<IDiscussion> {
    return this.discussionRepository.create(discussion);
  }

  async getDiscussionById(id: string): Promise<IDiscussion | null> {
    return this.discussionRepository.findById(id);
  }

  async addReply(discussionId: string, reply: any): Promise<IDiscussion | null> {
    return this.discussionRepository.addReply(discussionId, reply);
  }
}