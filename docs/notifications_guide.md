# Student Portal Notification System: A Developer's Guide

This document provides a comprehensive overview of the notification system for the Student Portal backend, designed to help mobile (Flutter) and web developers integrate their clients seamlessly.

## 1. System Architecture

The notification system is built to be robust, scalable, and real-time. It uses a combination of technologies to ensure that users are notified promptly of relevant events across different platforms.

### Core Components

1.  **Notification Service (`notification.service.ts`)**: The central point for all notification-related logic. However, it does not perform heavy lifting directly. Its primary role is to act as a gateway that schedules notification jobs.

2.  **Agenda.js (`agenda.ts`, `notificationJobs.ts`)**: A powerful job scheduling library for Node.js. We use it as a persistent job queue to handle notification creation and delivery asynchronously. This prevents API requests from being blocked while waiting for notifications to be sent and ensures that notifications are not lost if the server restarts.

3.  **Firebase Cloud Messaging (FCM) (`fcm.service.ts`)**: The service responsible for sending push notifications to mobile devices (Android and iOS).

4.  **Socket.IO (`socket.ts`)**: Used for sending real-time notifications to connected web clients.

### Notification Flow

Here’s the step-by-step flow of a notification:

1.  **Trigger**: An event occurs in the application that needs to trigger a notification (e.g., a new message is sent, a user posts a new discussion, a user publishes a new resource).

2.  **Scheduling**: The relevant controller (e.g., `discussion.controller.ts`) calls `notificationService.createNotification()`.

3.  **Enqueuing**: The `notificationService` **does not** create the notification immediately. Instead, it creates a new job named `create-and-deliver-notification` and places it into the Agenda job queue. This makes the initial API call very fast.

4.  **Background Processing**: An Agenda worker picks up the job from the queue and executes it. The job's logic (defined in `notificationJobs.ts`) performs the following steps:
    a. Creates a new `Notification` document in the MongoDB database.
    b. Determines the correct delivery channel (`fcm`, `socket`, or `all`).
    c. If FCM is required, it schedules a *second* job, `send-fcm-notification`, which uses the `fcmService` to send the push notification.
    d. If Socket.IO is required, it emits a `'notification'` event directly to the user's room.

This two-step job process ensures that even if the external FCM service is slow, it doesn't block other background jobs from running.

---

## 2. Flutter App Integration Guide

To get notifications working in your Flutter app, follow these steps.

### Step 1: Firebase Setup

1.  **Firebase Project**: Ensure your Flutter app is connected to the same Firebase project that the backend is using. The backend requires a Firebase Admin SDK service account key file (a `.json` file) to authenticate with Firebase.

2.  **Add Dependencies**: Add the `firebase_core` and `firebase_messaging` packages to your `pubspec.yaml`.

### Step 2: Get and Register the FCM Token

When the app starts, and after the user logs in, you must get the device's FCM token and send it to the backend.

```dart
// main.dart or equivalent initialization file
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> initializeFirebase() async {
  await Firebase.initializeApp();

  // Request permission for notifications (for iOS and web)
  await FirebaseMessaging.instance.requestPermission();

  // Get the token
  final fcmToken = await FirebaseMessaging.instance.getToken();

  if (fcmToken != null) {
    // Send the token to your backend
    await registerFcmToken(fcmToken);
  }

  // Listen for token refreshes
  FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
    // Send the new token to your backend
    await registerFcmToken(newToken);
  });
}

Future<void> registerFcmToken(String token) async {
  // Use your API service to make a POST request
  // to /api/v1/fcm/register
  // Make sure to include the user's auth token in the headers
  await yourApiService.post('/api/v1/fcm/register', {'fcmToken': token});
}
```

### Step 3: Handle Incoming Notifications

You need to handle notifications when the app is in three states: foreground, background, and terminated.

```dart
// main.dart or equivalent initialization file

void setupNotificationHandlers() {
  // 1. When the app is in the foreground
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    print('Got a message whilst in the foreground!');
    print('Message data: ${message.data}');

    if (message.notification != null) {
      print('Message also contained a notification: ${message.notification}');
      // You can show a local notification using a package like flutter_local_notifications
    }
  });

  // 2. When the app is in the background or terminated and the user taps the notification
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    print('A new onMessageOpenedApp event was published!');
    // Navigate to the correct screen based on the message data
    // e.g., if (message.data['type'] == 'new_message') { ... }
  });
}
```

### Step 4: Unregister the Token on Logout

When a user logs out, it's crucial to unregister their FCM token to prevent them from receiving notifications intended for another user who might log in on the same device.

```dart
Future<void> logout() async {
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken != null) {
    // Make a POST request to /api/v1/fcm/unregister
    await yourApiService.post('/api/v1/fcm/unregister', {'fcmToken': fcmToken});
  }
  // ... proceed with clearing local user data and logging out
}
```

### Notification Payload Structure

The `data` payload of the FCM message will contain useful information to help your app navigate and display content.

```json
{
  "notification": {
    "title": "New Discussion",
    "body": "John Doe posted a new discussion: 'Flutter Best Practices'"
  },
  "data": {
    "type": "new_discussion",
    "discussionId": "60d5f1b3e6b3f1b3e6b3f1b3",
    "creatorName": "John Doe",
    "notificationId": "60d5f1b3e6b3f1b3e6b3f1b4"
    // ... other relevant metadata
  }
}
```

## 3. Real-time Updates with Socket.IO

While FCM is great for push notifications, Socket.IO is used for real-time updates when the app is in the foreground (e.g., updating the unread notification count badge).

Your Flutter app should connect to the backend socket server and listen for these events:

-   `'notification'`: Received when a new notification is created for the user. The payload is the full notification object.
-   `'unreadCountUpdate'`: Received whenever the user's unread notification count changes. The payload is `{ count: number }`.

By combining FCM and Socket.IO, you can provide a seamless and responsive notification experience.
