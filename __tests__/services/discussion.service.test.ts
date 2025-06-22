import { jest } from '@jest/globals';
import { DiscussionService } from '../../src/services/discussion.service';
import { DiscussionRepository } from '../../src/repositories/discussion.repo';
import { UploadService } from '../../src/utils/uploadService';
import { Types } from 'mongoose';
import { IDiscussion, IAttachment, IReply } from '../../src/models/types';

jest.mock('../../src/repositories/discussion.repo', () => ({
  DiscussionRepository: jest.fn().mockImplementation(() => ({
    find: jest.fn(),
    deleteMany: jest.fn(),
  })),
}));

jest.mock('../../src/utils/uploadService', () => ({
  UploadService: jest.fn().mockImplementation(() => ({
    deleteFiles: jest.fn(),
  })),
}));

describe('DiscussionService', () => {
  let discussionService: DiscussionService;
  let discussionRepository: jest.Mocked<DiscussionRepository>;
  let uploadService: jest.Mocked<UploadService>;

  beforeEach(() => {
    jest.clearAllMocks();
    discussionRepository = new DiscussionRepository() as jest.Mocked<DiscussionRepository>;
    uploadService = new UploadService() as jest.Mocked<UploadService>;
    discussionService = new DiscussionService(discussionRepository, uploadService);
  });

  describe('bulkDeleteDiscussions', () => {
    it('should delete discussions and their associated attachments from Cloudinary', async () => {
      // Arrange
      const discussionIds = [new Types.ObjectId().toHexString(), new Types.ObjectId().toHexString()];
      const discussions: Partial<IDiscussion>[] = [
        {
          _id: new Types.ObjectId(discussionIds[0]),
          attachments: [{ checksum: 'public_id_1' } as IAttachment],
          replies: [
            {
              attachments: [{ checksum: 'public_id_2' } as IAttachment],
              replies: [],
            } as unknown as IReply,
          ],
        },
        {
          _id: new Types.ObjectId(discussionIds[1]),
          attachments: [{ checksum: 'public_id_3' } as IAttachment],
          replies: [],
        },
      ];

      discussionRepository.find.mockResolvedValue(discussions as IDiscussion[]);
      uploadService.deleteFiles.mockResolvedValue({ result: 'ok' });
      discussionRepository.deleteMany.mockResolvedValue({ deletedCount: 2 });

      // Act
      const result = await discussionService.bulkDeleteDiscussions(discussionIds);

      // Assert
      const expectedPublicIds = ['public_id_1', 'public_id_2', 'public_id_3'];
      expect(discussionRepository.find).toHaveBeenCalledWith({ _id: { $in: discussionIds } });
      expect(uploadService.deleteFiles).toHaveBeenCalledWith(expectedPublicIds);
      expect(discussionRepository.deleteMany).toHaveBeenCalledWith({ _id: { $in: discussionIds } });
      expect(result).toBe(2);
    });

    it('should continue to delete discussions even if file deletion fails', async () => {
      // Arrange
      const discussionIds = [new Types.ObjectId().toHexString()];
      const discussions: Partial<IDiscussion>[] = [
        {
          _id: new Types.ObjectId(discussionIds[0]),
          attachments: [{ checksum: 'public_id_1' } as IAttachment],
          replies: [],
        },
      ];
      const deletionError = new Error('Cloudinary error');

      console.error = jest.fn();

      discussionRepository.find.mockResolvedValue(discussions as IDiscussion[]);
      uploadService.deleteFiles.mockRejectedValue(deletionError);
      discussionRepository.deleteMany.mockResolvedValue({ deletedCount: 1 });

      // Act
      const result = await discussionService.bulkDeleteDiscussions(discussionIds);

      // Assert
      expect(discussionRepository.find).toHaveBeenCalledWith({ _id: { $in: discussionIds } });
      expect(uploadService.deleteFiles).toHaveBeenCalledWith(['public_id_1']);
      expect(console.error).toHaveBeenCalledWith('Failed to bulk delete discussion attachments:', deletionError);
      expect(discussionRepository.deleteMany).toHaveBeenCalledWith({ _id: { $in: discussionIds } });
      expect(result).toBe(1);
    });

    it('should not call deleteFiles if there are no attachments', async () => {
      // Arrange
      const discussionIds = [new Types.ObjectId().toHexString()];
      const discussions: Partial<IDiscussion>[] = [
        {
          _id: new Types.ObjectId(discussionIds[0]),
          attachments: [],
          replies: [],
        },
      ];

      discussionRepository.find.mockResolvedValue(discussions as IDiscussion[]);
      discussionRepository.deleteMany.mockResolvedValue({ deletedCount: 1 });

      // Act
      const result = await discussionService.bulkDeleteDiscussions(discussionIds);

      // Assert
      expect(uploadService.deleteFiles).not.toHaveBeenCalled();
      expect(discussionRepository.deleteMany).toHaveBeenCalledWith({ _id: { $in: discussionIds } });
      expect(result).toBe(1);
    });
  });
});
