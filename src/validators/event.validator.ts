import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateEventCreation = (req: Request, res: Response, next: NextFunction) => {
  const { title, description, startDate, endDate } = req.body;

  if (!title) {
    throw new ValidationError('Event title is required');
  }

  if (!description) {
    throw new ValidationError('Event description is required');
  }

  if (!startDate) {
    throw new ValidationError('Event start date is required');
  }

  if (!endDate) {
    throw new ValidationError('Event end date is required');
  }

  if (new Date(startDate) > new Date(endDate)) {
    throw new ValidationError('Event start date must be before end date');
  }

  next();
};

export const validateEventUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate } = req.body;

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new ValidationError('Event start date must be before end date');
  }

  next();
}; 