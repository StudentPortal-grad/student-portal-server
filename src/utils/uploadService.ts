import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { AppError, ErrorCodes } from './appError';
import { Request, Response, NextFunction, Express, RequestHandler } from 'express';
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

// Create a more flexible storage configuration
const createCloudinaryStorage = (folder: string) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `student_portal/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' },
      ],
    } as any,
  });
};

// Generic file filter
const imageFileFilter = (
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

// Create a generic upload middleware
export const createUploadMiddleware = (
  fieldConfig: string | multer.Field[],
  folder: string = 'uploads'
) => {
  try {
    validateCloudinaryConfig();
    const multerOptions: multer.Options = {
      storage: createCloudinaryStorage(folder),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: imageFileFilter,
    };

    const uploader = multer(multerOptions);
    let uploadHandler: RequestHandler;

    if (typeof fieldConfig === 'string') {
      uploadHandler = uploader.single(fieldConfig);
    } else {
      uploadHandler = uploader.fields(fieldConfig);
    }

    // Return middleware that handles the upload and sets the field(s)
    return (req: Request, res: Response, next: NextFunction) => {
      uploadHandler(req, res, (err: any) => {
        if (err) {
          return next(
            new AppError(
              err.message || 'File upload failed',
              400,
              ErrorCodes.UPLOAD_ERROR
            )
          );
        }

        // If file(s) were uploaded, set the URL(s) in the request body
        if (typeof fieldConfig === 'string' && req.file) {
          req.body[fieldConfig] = req.file.path;
        } else if (typeof fieldConfig !== 'string' && req.files) {
          const files = req.files as { [fieldname: string]: Express.Multer.File[] };
          for (const field of fieldConfig) {
            if (files[field.name] && files[field.name][0]) {
              req.body[field.name] = files[field.name][0].path;
            }
          }
        }
        // console.log('Request body after upload:', req.body);
        // console.log('Uploaded req.file:', req.file);
        // console.log('Uploaded req.files:', req.files);
        next();
      });
    };
  } catch (error) {
    console.error('File upload service configuration error:', error);
    return (_req: Request, _res: Response, next: NextFunction) => {
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

// Specific middleware for profile pictures
export const uploadProfilePicture = createUploadMiddleware(
  'profilePicture',
  'profile_pictures'
);

// Specific middleware for group conversation images
export const uploadGroupImage = createUploadMiddleware(
  'groupImage',
  'group_images'
);

// Specific middleware for event images
export const uploadEventImage = createUploadMiddleware(
  'eventImage',
  'event_images'
);

// Specific middleware for resource files (likely for single, generic file uploads)
export const uploadSingleResourceFile = createUploadMiddleware(
  'fileUrl',
  'resources'
);

// --- New Configuration for Discussion Attachments ---
const discussionAttachmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'student_portal/discussion_attachments',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'odt', 'mp4', 'mov', 'avi', 'mkv', 'webm'],
    // No specific transformations applied here to keep original files for docs/videos etc.
  } as any,
});

const attachmentFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // More permissive filter for general attachments, or remove if not needed
  // For now, accept all files and let Cloudinary handle validation/errors for unsupported types
  cb(null, true);
};

export const uploadDiscussionAttachments = multer({
  storage: discussionAttachmentStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit, consistent with Discussion model
  },
  fileFilter: attachmentFileFilter, // Using a more permissive filter
}).array('attachments', 10); // Expects an array of files from a field named 'attachments', max 10 files

// --- End New Configuration for Discussion Attachments ---

// Specific middleware for community icon and banner
export const uploadCommunityImages = createUploadMiddleware(
  [
    { name: 'icon', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ],
  'community_assets' // Folder name in Cloudinary
);

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
    return `student_portal/${filename.split('.')[0]}`;
  }

  static async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl || fileUrl === 'https://via.placeholder.com/150') return;

    try {
      const publicId = this.getPublicIdFromUrl(fileUrl);
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new AppError(
        'Error deleting file from storage',
        500,
        ErrorCodes.UPLOAD_ERROR,
        error
      );
    }
  }
}
