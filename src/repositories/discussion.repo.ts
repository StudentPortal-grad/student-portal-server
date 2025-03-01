import { IDiscussion } from '../models/Discussion';
import Discussion from '../models/Discussion';

export class DiscussionRepository {
  async create(discussion: Partial<IDiscussion>): Promise<IDiscussion> {
    return Discussion.create(discussion);
  }

  async findById(id: string): Promise<IDiscussion | null> {
    return Discussion.findById(id).exec();
  }

  async addReply(discussionId: string, reply: any): Promise<IDiscussion | null> {
    return Discussion.findByIdAndUpdate(
      discussionId,
      { $push: { replies: reply } },
      { new: true }
    ).exec();
  }
}