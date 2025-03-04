import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { AppError, ErrorCodes } from './appError';
import { Request, Express } from 'express';

/* global process */

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'student_portal/profile_pictures',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' }
    ],
  } as any
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(new AppError('Only image files are allowed!', 400, ErrorCodes.INVALID_FILE_TYPE));
    return;
  }
  cb(null, true);
};

// Create multer upload instance for profile pictures
export const uploadProfilePicture = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
}).single('profilePicture');

export class UploadService {
  /**
   * Upload a file to Cloudinary
   * @param file The file to upload (base64 or file path)
   * @param folder The folder to upload to
   * @returns The uploaded file URL
   */
  static async uploadToCloudinary(
    file: string,
    folder: string = 'student_portal'
  ): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto' },
        ],
      });

      return result.secure_url;
    } catch (error) {
      throw new AppError(
        'Error uploading file to Cloudinary',
        500,
        ErrorCodes.UPLOAD_ERROR,
        error
      );
    }
  }

  /**
   * Delete a file from Cloudinary
   * @param publicId The public ID of the file to delete
   */
  static async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new AppError(
        'Error deleting file from Cloudinary',
        500,
        ErrorCodes.UPLOAD_ERROR,
        error
      );
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param url The Cloudinary URL
   * @returns The public ID
   */
  static getPublicIdFromUrl(url: string): string {
    const splitUrl = url.split('/');
    const filename = splitUrl[splitUrl.length - 1];
    return filename.split('.')[0];
  }
}
