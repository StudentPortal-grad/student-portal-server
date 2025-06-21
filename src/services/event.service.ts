import { IEvent } from '@models/types';
import { AppError, ErrorCodes } from '../utils/appError';
import Event from '@models/Event';
import { Types } from 'mongoose';
import { UploadService } from '../utils/uploadService';

const uploadService = new UploadService();

export class EventService {
  /**
   * Delete an event by its ID.
   * @param {string} eventId - The ID of the event to delete.
   * @returns {Promise<void>}
   */
  async deleteEvent(eventId: string): Promise<void> {
    const event = await Event.findById(eventId);

    if (!event) {
      throw new AppError('Event not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Delete the event image from Cloudinary
    if (event.eventImage && !event.eventImage.includes('placeholder.com')) {
      try {
        const publicId = uploadService.getPublicIdFromUrl(event.eventImage);
        await uploadService.deleteFile(publicId);
      } catch (error) {
        console.error(`Failed to delete event image ${event.eventImage}:`, error);
      }
    }

    await Event.findByIdAndDelete(eventId);
  }

  /**
   * Bulk delete events by their IDs.
   * @param {string[]} eventIds - An array of event IDs to delete.
   * @returns {Promise<{ deletedCount: number }>} The number of deleted events.
   */
  async bulkDeleteEvents(eventIds: string[]): Promise<{ deletedCount: number }> {
    const objectIds = eventIds.map(id => new Types.ObjectId(id));

    // Find all events to be deleted to get their image URLs
    const eventsToDelete = await Event.find({ _id: { $in: objectIds } });

    if (eventsToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    // Collect all image URLs to be deleted, filtering out placeholders
    const publicIds = eventsToDelete
      .map(event => {
        if (event.eventImage && !event.eventImage.includes('placeholder.com')) {
          return uploadService.getPublicIdFromUrl(event.eventImage);
        }
        return null;
      })
      .filter((id): id is string => id !== null);

    // Delete images from Cloudinary in bulk
    if (publicIds.length > 0) {
      await uploadService.deleteFiles(publicIds).catch(err => {
        console.error('Error bulk deleting event images:', err);
      });
    }

    // Delete the events from the database
    const result = await Event.deleteMany({
      _id: { $in: objectIds },
    });

    return { deletedCount: result.deletedCount || 0 };
  }
}

