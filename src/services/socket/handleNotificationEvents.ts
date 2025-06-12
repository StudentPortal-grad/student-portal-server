import { Socket } from 'socket.io';
import { EventsManager } from '@utils/EventsManager';

export const handleNotificationEvents = (socket: Socket) => {
  // Join user's notification room
  socket.on('join-notifications', (userId: string) => {
    socket.join(userId);
  });

  // Leave user's notification room
  socket.on('leave-notifications', (userId: string) => {
    socket.leave(userId);
  });
};