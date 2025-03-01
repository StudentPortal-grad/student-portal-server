import { Request, Response } from 'express';
import { DiscussionService } from '../services/discussion.service';

const discussionService = new DiscussionService();

export const createDiscussion = async (req: Request, res: Response) => {
  const discussion = await discussionService.createDiscussion(req.body);
  res.status(201).json(discussion);
};

export const getDiscussionById = async (req: Request, res: Response) => {
  const discussion = await discussionService.getDiscussionById(req.params.id);
  res.status(200).json(discussion);
};

export const addReply = async (req: Request, res: Response) => {
  const { id } = req.params;
  const reply = req.body;
  const discussion = await discussionService.addReply(id, reply);
  res.status(200).json(discussion);
};
