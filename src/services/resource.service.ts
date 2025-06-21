import Resource from '@models/Resource';
import { IResource, IComment } from '@models/types';
import { AppError, ErrorCodes } from '@utils/appError';
import { UploadService } from '@utils/uploadService';
import { Types } from 'mongoose';

export class ResourceService {
  private uploadService: UploadService;

  constructor() {
    this.uploadService = new UploadService();
  }
  /**
   * Edit a comment on a resource.
   */
  async editComment(
    resourceId: string,
    commentId: string,
    userId: Types.ObjectId,
    content: string
  ): Promise<IResource> {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND);
    }

    const comment = resource.comments.find(
      (c: IComment) => c._id.equals(commentId)
    );

    if (!comment) {
      throw new AppError('Comment not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!comment.userId.equals(userId)) {
      throw new AppError(
        'You are not authorized to edit this comment',
        403,
        ErrorCodes.FORBIDDEN
      );
    }

    comment.content = content;
    await resource.save();
    return resource;
  }

  /**
   * Delete a comment from a resource.
   */
  async bulkDeleteResources(resourceIds: string[]): Promise<{ deletedCount: number }> {
    const resourcesToDelete = await Resource.find({
      _id: { $in: resourceIds.map(id => new Types.ObjectId(id)) }
    }).select('checksum');

    if (resourcesToDelete.length > 0) {
      const publicIds = resourcesToDelete
        .map(resource => resource.checksum)
        .filter(checksum => checksum && !checksum.includes('placeholder.com'));

      if (publicIds.length > 0) {
        try {
          await this.uploadService.deleteFiles(publicIds);
        } catch (error) {
          console.error('Error deleting files from Cloudinary:', error);
          // Decide if you want to throw or just log. For now, we log and continue.
        }
      }
    }

    const result = await Resource.deleteMany({
      _id: { $in: resourceIds.map(id => new Types.ObjectId(id)) }
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  /**
   * Delete a comment from a resource.
   */
  async deleteComment(
    resourceId: string,
    commentId: string,
    userId: Types.ObjectId
  ): Promise<IResource> {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new AppError('Resource not found', 404, ErrorCodes.NOT_FOUND);
    }

    const commentIndex = resource.comments.findIndex(
      (c: IComment) => c._id.equals(commentId)
    );

    if (commentIndex === -1) {
      throw new AppError('Comment not found', 404, ErrorCodes.NOT_FOUND);
    }

    const comment = resource.comments[commentIndex];
    if (!comment.userId.equals(userId)) {
      throw new AppError(
        'You are not authorized to delete this comment',
        403,
        ErrorCodes.FORBIDDEN
      );
    }

    resource.comments.splice(commentIndex, 1);
    await resource.save();
    return resource;
  }
}
