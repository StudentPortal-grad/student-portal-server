import { Types } from 'mongoose';
import Event from '@models/Event';
import RSVP from '@models/RSVP';
import User from '@models/User';
import Resource from '@models/Resource';
import { IEvent, IUser, IResource } from '@models/types';

/**
 * Generate event recommendations for a user based on their interests and past event attendance
 * @param userId The user ID to generate recommendations for
 * @param limit The maximum number of recommendations to return
 * @returns Array of recommended events
 */
export const generateEventRecommendations = async (
  userId: string,
  limit: number = 5
): Promise<IEvent[]> => {
  // Get user's past RSVPs to understand their interests
  const userRSVPs = await RSVP.find({ userId, status: 'attending' })
    .populate('eventId')
    .lean();

  // Get user's communities from roles
  const user = await User.findById(userId).lean();
  if (!user) return [];

  // Extract community IDs from user roles
  const userCommunities = (user.roles || []).map(role => role.communityId);

  // Extract categories/topics from past events
  const eventIds = userRSVPs.map(rsvp => rsvp.eventId._id);
  const pastEvents = await Event.find({ _id: { $in: eventIds } }).lean();

  // Find upcoming events that match user's interests
  // 1. Events from the same communities
  // 2. Events with similar topics/categories
  // 3. Popular events (high attendance)
  const now = new Date();
  
  // Base query: upcoming events not already RSVP'd
  const baseQuery = {
    dateTime: { $gt: now },
    status: 'upcoming',
    _id: { $nin: eventIds } // Exclude events user has already RSVP'd to
  };

  // Community-based recommendations
  const communityEvents = await Event.find({
    ...baseQuery,
    communityId: { $in: userCommunities }
  })
    .sort({ dateTime: 1 })
    .limit(Math.ceil(limit / 2))
    .lean();

  // Popularity-based recommendations (events with most RSVPs)
  const popularEventIds = await RSVP.aggregate([
    { $match: { status: 'attending' } },
    { $group: { _id: '$eventId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  const popularEvents = await Event.find({
    ...baseQuery,
    _id: { $in: popularEventIds.map(e => e._id) }
  })
    .limit(limit - communityEvents.length)
    .lean();

  // Combine and deduplicate recommendations
  const recommendations = [...communityEvents];
  
  // Add popular events that aren't already in recommendations
  popularEvents.forEach(event => {
    if (!recommendations.some(rec => rec._id.toString() === event._id.toString())) {
      recommendations.push(event);
    }
  });

  // Limit to requested number
  return recommendations.slice(0, limit) as unknown as IEvent[];
};

/**
 * Generate resource recommendations for a user based on their interests and past interactions
 * @param userId The user ID to generate recommendations for
 * @param limit The maximum number of recommendations to return
 * @returns Array of recommended resources
 */
export const generateResourceRecommendations = async (
  userId: string,
  limit: number = 5
): Promise<IResource[]> => {
  // Get user's past resource interactions (views, downloads, ratings)
  const user = await User.findById(userId).lean();
  if (!user) return [];

  // Extract community IDs from user roles
  const userCommunities = (user.roles || []).map(role => role.communityId);

  // Find resources the user has interacted with
  const resources = await Resource.find({
    $or: [
      { 'ratings.userId': userId },
      { 'comments.userId': userId },
      { 'interactionStats.viewedBy': userId },
      { 'interactionStats.downloadedBy': userId }
    ]
  }).lean();

  // Get categories/tags from resources user has interacted with
  const resourceCategories = resources
    .map(resource => resource.category)
    .filter(Boolean);

  const resourceTags = resources
    .flatMap(resource => resource.tags || [])
    .filter(Boolean);

  // Find resources in same categories/tags that user hasn't interacted with
  const interactedResourceIds = resources.map(r => r._id);

  // Base query: resources user hasn't interacted with
  const baseQuery = {
    _id: { $nin: interactedResourceIds }
  };

  // Category-based recommendations
  const categoryResources = await Resource.find({
    ...baseQuery,
    category: { $in: resourceCategories }
  })
    .sort({ 'interactionStats.views': -1 })
    .limit(Math.ceil(limit / 2))
    .lean();

  // Tag-based recommendations
  const tagResources = await Resource.find({
    ...baseQuery,
    tags: { $in: resourceTags }
  })
    .sort({ 'interactionStats.views': -1 })
    .limit(limit - categoryResources.length)
    .lean();

  // Community-based recommendations
  const communityResources = await Resource.find({
    ...baseQuery,
    communityId: { $in: userCommunities }
  })
    .sort({ 'interactionStats.views': -1 })
    .limit(limit - (categoryResources.length + tagResources.length))
    .lean();

  // Combine and deduplicate recommendations
  const recommendations = [...categoryResources];
  
  // Add tag-based resources that aren't already in recommendations
  tagResources.forEach(resource => {
    if (!recommendations.some(rec => rec._id.toString() === resource._id.toString())) {
      recommendations.push(resource);
    }
  });

  // Add community-based resources that aren't already in recommendations
  communityResources.forEach(resource => {
    if (!recommendations.some(rec => rec._id.toString() === resource._id.toString())) {
      recommendations.push(resource);
    }
  });

  // Limit to requested number
  return recommendations.slice(0, limit);
};
