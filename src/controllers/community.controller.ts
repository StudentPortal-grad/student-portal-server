import { Request, Response, NextFunction } from 'express';
import { CommunityService } from '../services/community.service';

const communityService = new CommunityService();

export const createCommunity = async (req: Request, res: Response, next: NextFunction) => {
    const community = await communityService.createCommunity(req.body);
    res.status(201).json({ data: community });
};

export const getAllCommunities = async (req: Request, res: Response, next: NextFunction) => {
    const communities = await communityService.getAllCommunities();
    res.status(200).json({ data: communities });
};

export const joinCommunity = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId } = req.body;
    const community = await communityService.joinCommunity(id, userId);
    res.status(200).json({ data: community });
};