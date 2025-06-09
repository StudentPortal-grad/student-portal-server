import { Request, Response } from 'express';
import { AppError } from '../utils/appError';
import { CommunityService } from '../services/community.service';
import { getPaginationOptions } from '../utils/pagination';
import { resourceQuerySchema } from '../validations/communityValidation';

const communityService = new CommunityService();

export const createCommunity = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const community = await communityService.createCommunity({
    ...req.body,
    owner: req.user._id
  });
  res.success(community, 'Community created successfully', 201);
};

export const getAllCommunities = async (req: Request, res: Response) => {
  const paginationOptions = getPaginationOptions(req.query);
  const { communities, metadata } = await communityService.getAllCommunities(paginationOptions);
  
  res.paginated(communities, metadata, 'Communities retrieved successfully');
};

export const getCommunityById = async (req: Request, res: Response) => {
  const community = await communityService.getCommunityById(req.params.id);
  res.success(community, 'Community retrieved successfully');
};

export const updateCommunity = async (req: Request, res: Response) => {
  const community = await communityService.updateCommunity(req.params.id, req.body);
  res.success(community, 'Community updated successfully');
};

export const deleteCommunity = async (req: Request, res: Response) => {
  await communityService.deleteCommunity(req.params.id);
  res.success(null, 'Community deleted successfully');
};

export const joinCommunity = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }

  const community = await communityService.joinCommunity(
    req.params.id,
    req.user._id.toString(),
    req.body.inviteCode
  );
  res.success(community, 'Joined community successfully');
};

export const leaveCommunity = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }
  await communityService.leaveCommunity(req.params.id, req.user._id.toString());
  res.success(null, 'Left community successfully');
};

export const generateInviteLink = async (req: Request, res: Response) => {
  const inviteLink = await communityService.generateInviteLink(req.params.id);
  res.success({ inviteLink }, 'Invite link generated successfully');
};

export const getCommunityMembers = async (req: Request, res: Response) => {
  const paginationOptions = getPaginationOptions(req.query);
  const { members, metadata } = await communityService.getCommunityMembers(
    req.params.id,
    paginationOptions
  );
  
  res.paginated(members, metadata, 'Community members retrieved successfully');
};

export const getCommunityRoles = async (req: Request, res: Response) => {
  const roles = await communityService.getCommunityRoles(req.params.id);
  res.success(roles, 'Community roles retrieved successfully');
};

export const getCommunityResources = async (req: Request, res: Response) => {
  const { error, value } = resourceQuerySchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { resources, metadata } = await communityService.getCommunityResources(
    req.params.communityId,
    value
  );

  const paginationMetadata = {
    total: metadata.total,
    page: metadata.page,
    limit: metadata.limit,
    totalPages: metadata.pages,
    hasNextPage: metadata.page < metadata.pages,
    hasPrevPage: metadata.page > 1
  };

  res.paginated(resources, paginationMetadata, 'Resources retrieved successfully');
};

export const addCommunityMember = async (req: Request, res: Response) => {
  const member = await communityService.addCommunityMember(
    req.params.communityId,
    req.body
  );

  res.success(member, 'Member added successfully', 201);
};

export const removeCommunityMember = async (req: Request, res: Response) => {
  await communityService.removeCommunityMember(
    req.params.communityId,
    req.params.userId
  );

  res.success(null, 'Member removed successfully');
};

export const getCommunityMetrics = async (_req: Request, res: Response) => {
  const metrics = await communityService.getMetrics();
  res.success(metrics, 'Community metrics retrieved successfully');
};