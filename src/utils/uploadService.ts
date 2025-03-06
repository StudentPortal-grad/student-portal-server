import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { AppError, ErrorCodes } from './appError';
import { Request, Response, NextFunction, Express } from 'express';
import { config } from 'dotenv';

config();

/* global process */

// Validate Cloudinary credentials
const validateCloudinaryConfig = () => {
  const requiredEnvVars = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new AppError(
      `Missing required environment variables: ${missingVars.join(', ')}`,
      500,
      ErrorCodes.CONFIG_ERROR
    );
  }
};

// Configure Cloudinary
try {
  validateCloudinaryConfig();
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (error) {
  console.error('Cloudinary configuration error:', error);
}

// Configure Multer storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'student_portal/profile_pictures',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' },
    ],
  } as any,
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(
      new AppError(
        'Only image files are allowed!',
        400,
        ErrorCodes.INVALID_FILE_TYPE
      )
    );
    return;
  }
  cb(null, true);
};

// Create multer upload instance for profile pictures with error handling
const createProfilePictureUpload = () => {
  try {
    validateCloudinaryConfig();
    return multer({
      storage: storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: fileFilter,
    }).single('profilePicture');
  } catch (error) {
    console.error('File upload service configuration error:', error);
    // Return middleware that always errors
    return (req: Request, _res: Response, next: NextFunction) => {
      next(
        new AppError(
          'File upload service is not configured properly',
          500,
          ErrorCodes.CONFIG_ERROR
        )
      );
    };
  }
};

export const uploadProfilePicture = createProfilePictureUpload();

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
