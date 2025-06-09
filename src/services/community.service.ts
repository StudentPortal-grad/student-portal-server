import { Types } from "mongoose";
import { CommunityRepository } from "../repositories/community.repo";
import { ICommunity } from "../models/types";
import { AppError } from "../utils/appError";
import { UploadService } from "../utils/uploadService";
import { PaginationOptions } from "../utils/pagination";
import { ResourceRepository } from "../repositories/resource.repo";

export class CommunityService {
    private communityRepository: CommunityRepository;
    private resourceRepository: ResourceRepository;

    constructor() {
        this.communityRepository = new CommunityRepository();
        this.resourceRepository = new ResourceRepository();
    }

    async createCommunity(
        communityData: Partial<ICommunity>
    ): Promise<ICommunity> {
        return this.communityRepository.create(communityData);
    }

    async getAllCommunities(options: PaginationOptions) {
        const { docs, ...metadata } =
            await this.communityRepository.findAllPaginated(options);
        return {
            communities: docs,
            metadata,
        };
    }

    async getCommunityById(id: string): Promise<ICommunity> {
        const community = await this.communityRepository.findById(id);
        if (!community) {
            throw new AppError("Community not found", 404, "NOT_FOUND");
        }
        return community;
    }

    async updateCommunity(
        id: string,
        updateData: Partial<ICommunity>
    ): Promise<ICommunity> {
        const community = await this.communityRepository.update(id, updateData);
        if (!community) {
            throw new AppError("Community not found", 404, "NOT_FOUND");
        }
        return community;
    }

    async deleteCommunity(id: string): Promise<void> {
        const community = await this.getCommunityById(id);

        // Delete community icon if exists
        if (community.icon) {
            const publicId = UploadService.getPublicIdFromUrl(community.icon);
            await UploadService.deleteFromCloudinary(publicId);
        }

        await this.communityRepository.delete(id);
    }

    async joinCommunity(
        communityId: string,
        userId: string,
        inviteCode?: string
    ): Promise<ICommunity> {
        const community = await this.getCommunityById(communityId);

        if (community.isMember(new Types.ObjectId(userId))) {
            throw new AppError("Already a member", 400, "BAD_REQUEST");
        }

        if (community.settings.isPrivate && !inviteCode) {
            throw new AppError("Invite code required", 400, "BAD_REQUEST");
        }
        const updatedCommunity = await this.communityRepository.joinCommunity(
            communityId,
            userId
        );
        if (!updatedCommunity) {
            throw new AppError(
                "Failed to join community",
                500,
                "INTERNAL_SERVER_ERROR"
            );
        }
        return updatedCommunity;
    }

    async leaveCommunity(communityId: string, userId: string): Promise<void> {
        const community = await this.getCommunityById(communityId);

        if (!community.isMember(new Types.ObjectId(userId))) {
            throw new AppError("Not a member", 400, "BAD_REQUEST");
        }

        if (community.owner.toString() === userId) {
            throw new AppError(
                "Owner cannot leave community",
                400,
                "BAD_REQUEST"
            );
        }

        await community.removeMember(new Types.ObjectId(userId));
    }

    async generateInviteLink(communityId: string): Promise<string> {
        const community = await this.getCommunityById(communityId);
        return community.generateInvite();
    }

    async getCommunityMembers(communityId: string, options: PaginationOptions) {
        const { docs, ...metadata } =
            await this.communityRepository.findMembersPaginated(
                communityId,
                options
            );
        return {
            members: docs,
            metadata,
        };
    }

    async updateCommunityIcon(
        communityId: string,
        iconPath: string
    ): Promise<ICommunity> {
        const community = await this.getCommunityById(communityId);

        // Delete old icon if exists
        if (community.icon) {
            const publicId = UploadService.getPublicIdFromUrl(community.icon);
            await UploadService.deleteFromCloudinary(publicId);
        }

        // Upload new icon
        const iconUrl = await UploadService.uploadToCloudinary(
            iconPath,
            "student_portal/community_icons"
        );

        return this.updateCommunity(communityId, { icon: iconUrl });
    }

    async getCommunityRoles(communityId: string) {
        // const community = await this.getCommunityById(communityId);
        return this.communityRepository.findCommunityRoles(communityId);
    }

    async getCommunityResources(communityId: string, queryParams: any) {
        const community = await this.getCommunityById(communityId);

        // Build query
        const query: any = { _id: { $in: community.resources } };

        if (queryParams.category) {
            query.category = queryParams.category;
        }

        if (queryParams.tags) {
            query.tags = { $all: queryParams.tags };
        }

        if (queryParams.uploader) {
            query.uploader = new Types.ObjectId(queryParams.uploader);
        }

        if (queryParams.query) {
            query.$or = [
                { title: { $regex: queryParams.query, $options: "i" } },
                { description: { $regex: queryParams.query, $options: "i" } },
            ];
        }

        const { docs, ...metadata } =
            await this.resourceRepository.findWithPagination(query, {
                page: queryParams.page,
                limit: queryParams.limit,
                sort: { createdAt: -1 },
                populate: {
                    path: "uploader",
                    select: "name username profilePicture",
                },
            });

        return {
            resources: docs,
            metadata,
        };
    }

    async addCommunityMember(
        communityId: string,
        memberData: { userId: string; roleIds: string[] }
    ) {
        const community = await this.getCommunityById(communityId);

        if (community.isMember(new Types.ObjectId(memberData.userId))) {
            throw new AppError("User is already a member", 400, "BAD_REQUEST");
        }

        // Validate roles exist in this community
        if (memberData.roleIds && memberData.roleIds.length > 0) {
            const existingCommunityRoles = await this.communityRepository.findCommunityRoles(communityId);
            const existingRoleIds = new Set(existingCommunityRoles.map(role => role._id.toString()));

            for (const requestedRoleId of memberData.roleIds) {
                if (!existingRoleIds.has(requestedRoleId)) {
                    throw new AppError(
                        `Role with ID '${requestedRoleId}' does not exist or does not belong to this community.`,
                        400,
                        "BAD_REQUEST"
                    );
                }
            }
        }

        await community.addMember(
            new Types.ObjectId(memberData.userId),
            memberData.roleIds.map((id) => new Types.ObjectId(id))
        );

        return {
            userId: memberData.userId,
            roleIds: memberData.roleIds,
            joinedAt: new Date(),
        };
    }

    async removeCommunityMember(communityId: string, userId: string) {
        const community = await this.getCommunityById(communityId);

        if (!community.isMember(new Types.ObjectId(userId))) {
            throw new AppError("User is not a member", 400, "BAD_REQUEST");
        }

        if (community.owner.toString() === userId) {
            throw new AppError(
                "Cannot remove community owner",
                400,
                "BAD_REQUEST"
            );
        }

        await community.removeMember(new Types.ObjectId(userId));
    }

    async getMetrics() {
        const metrics = await this.communityRepository.getMetrics();
        if (!metrics) {
            throw new AppError(
                'Could not retrieve community metrics',
                 500, 
                 'INTERNAL_SERVER_ERROR'
            );
        }
        return metrics;
    }
}
