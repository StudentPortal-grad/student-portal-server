# **Student Portal - Backend Documentation**

## **Overview**
...

---

## **Project Structure**
```
server.ts                        # Main application entry point
src/
|── app.ts                        # Express app setup
│
├── config/                       # Configuration files
│   ├── db.ts                     # Database connection
│   ├── socket.ts                 # Socket.IO configuration
│   ├── env.ts                     # Environment variables
│   └── multer.ts           # File upload configuration
│
├── api/                          # REST API endpoints
│   ├── controllers/              # Controllers for handling requests
│   ├── routes/                   # API routes
│
├── middlewares/                  # Middleware for authentication, error handling, roles
│
├── models/                       # Mongoose models
│   ├── Notification.ts
│   ├── Conversation.ts
│   ├── Message.ts
│   ├── Resource.ts
│   ├── RSVP.ts
│   ├── Event.ts
│   ├── User.ts
│   ├── Discussion.ts
│   ├── Community.ts
│   └── Role.ts
│
├── sockets/                      # WebSocket handlers
│   ├── chat.ts                   # Real-time chat functionality
│   ├── notifications.ts          # Real-time notifications
│   └── events.ts                 # Real-time event updates
│
├── scheduler/                    # Event scheduler
│   └── eventScheduler.ts         # Handles event reminders
│
├── services/
│   ├── auth.service.ts            # Authentication service
│   ├── mailer.service.ts          # Email service for verification and notifications
│   ├── otp.service.ts             # OTP generation and validation
│   ├── uploader.service.ts        # File upload management
│   ├── validator.service.ts       # Data validation functions
│
├── utils/                        # Utility functions
│   ├── fileHelpers.ts           
│   ├── asyncHandler.ts           
│   ├── appError.ts
│   ├── queryBuilder.ts           # Query filtering and sorting
│
│── view/
│   ├── resetEmail.ts              # Email template for password reset
│   └── verifyEmail.ts             # Email template for account verification
└──
```

---

## **Tech Stack**
### **Backend Technologies**
- **Node.js** & **Express.js** 
- **TypeScript**
- **Mongoose** 
- **MongoDB**  

### **Authentication & Security**
- **JWT (JSON Web Tokens)** → User authentication and session management.  
- **OAuth 2.0 (Google Authentication)** → Enables Google Calendar event syncing.  
- **bcryptjs** → Secure password hashing.  
- **CORS** → Enhances API protection.  

### **Real-time Communication**
- **Socket.IO** → WebSockets for real-time chat, notifications, and event updates.  

### **File Handling & Media Uploads**
- **Multer** → Middleware for handling file uploads.  
- **Cloud Storage (Local for now)** → Stores uploaded academic resources.  

### **Email & Notifications**
- **Nodemailer** → Email verification, password reset, and event notifications.  
- **Firebase Cloud Messaging (FCM)** → Push notifications for mobile apps.  

### **Event Scheduling & Google Calendar Integration**
- **Google Calendar API** → Syncs events and RSVP data.  
- **Node-cron** → Schedules periodic tasks like event reminders.  

### **Developer Tools**
- **Postman** → API testing and debugging.   

---

