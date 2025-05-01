import { IEvent } from '../interfaces/event.interface';
import ical from 'ical-generator';
import { Document } from 'mongoose';

/* global process */

/**
 * Generate an iCal calendar file for a single event
 * @param event The event to generate the calendar for
 * @returns The iCal calendar as a string
 */
export const generateEventCalendar = (event: IEvent & Document): string => {
  const calendar = ical({ name: 'Student Portal Events' });
  
  // Add event to calendar
  calendar.createEvent({
    start: event.startDate,
    end: event.endDate,
    summary: event.title,
    description: event.description,
    location: event.location,
    url: `${process.env.FRONTEND_URL}/events/${event.id}`,
    organizer: {
      name: event.creatorId.toString(),
      email: 'noreply@studentportal.com'
    }
  });

  return calendar.toString();
};

/**
 * Generate an iCal calendar file for multiple events
 * @param events The events to generate the calendar for
 * @returns The iCal calendar as a string
 */
export const generateMultipleEventsCalendar = (events: (IEvent & Document)[]): string => {
  const calendar = ical({ name: 'Student Portal Events' });
  
  // Add events to calendar
  events.forEach(event => {
    calendar.createEvent({
      start: event.startDate,
      end: event.endDate,
      summary: event.title,
      description: event.description,
      location: event.location,
      url: `${process.env.FRONTEND_URL}/events/${event.id}`,
      organizer: {
        name: event.creatorId.toString(),
        email: 'noreply@studentportal.com'
      }
    });
  });

  return calendar.toString();
};

/**
 * Generate a Google Calendar URL for an event
 * @param event The event to generate the URL for
 * @returns The Google Calendar URL
 */
export const generateGoogleCalendarUrl = (event: IEvent): string => {
  const startDate = event.startDate.toISOString().replace(/-|:|\.\d+/g, '');
  const endDate = event.endDate.toISOString().replace(/-|:|\.\d+/g, '');
  
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', event.title);
  url.searchParams.append('dates', `${startDate}/${endDate}`);
  url.searchParams.append('details', event.description || '');
  url.searchParams.append('location', event.location || '');
  
  return url.toString();
};

/**
 * Generate an Outlook Calendar URL for an event
 * @param event The event to generate the URL for
 * @returns The Outlook Calendar URL
 */
export const generateOutlookCalendarUrl = (event: IEvent): string => {
  const startDate = event.startDate.toISOString();
  const endDate = event.endDate.toISOString();
  
  const url = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
  url.searchParams.append('subject', event.title);
  url.searchParams.append('startdt', startDate);
  url.searchParams.append('enddt', endDate);
  url.searchParams.append('body', event.description || '');
  url.searchParams.append('location', event.location || '');
  
  return url.toString();
};
