import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import serviceAccount from './studentportal-15b50-firebase-adminsdk-fbsvc-67b98aec48.json' assert { type: 'json' };

initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
});

export const messaging = getMessaging();
