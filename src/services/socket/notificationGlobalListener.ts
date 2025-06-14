import { EventsManager } from '@utils/EventsManager';

export const setupNotificationGlobalListener = (io: any) => {
  EventsManager.on('notification:created', async (notification) => {
    console.log('Broadcasting notification:', notification);
    io.to(notification.userId.toString()).emit('notification', notification);
  });
};