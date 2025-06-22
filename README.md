# **Student Portal - Backend Documentation**

## **Overview**
A **Node.js/TypeScript backend** for a student portal featuring real-time communication, event management, and academic resource sharing.

---

## **Project Structure**
```
src/
├── config/           # Configuration files (DB, Socket, etc.)
├── controllers/      # REST API controllers
├── models/          # Mongoose data models
├── routes/          # API route definitions
├── services/        # Business logic services
├── middleware/      # Express middleware
├── utils/           # Utility functions
├── jobs/            # Background job definitions
├── validations/     # Input validation schemas
└── types/           # TypeScript type definitions
```

---

## **Tech Stack**
### **Backend Core**
- **Node.js** with **Express.js** framework
- **TypeScript** → for type safety and better development experience
- **MongoDB** with **Mongoose** ODM
- **Socket.IO** → for real-time bidirectional communication

### **Authentication & Security**
- **JWT** → for stateless authentication
- **bcrypt** → for password hashing
- **OAuth 2.0** → for Google Calendar integration
- **CORS** and **Helmet** → for security headers
- **Rate limiting** → for API protection

### **File Handling & Storage**
- **Multer** → for file upload handling
- **Cloudinary** → for cloud storage and image processing
- **Local file system** → fallback

### **Background Processing**
- **Agenda.js** → for job scheduling and background tasks
- **Event-driven architecture** with custom event manager
- **Batch operations** → for performance optimization

### **Notifications & Communication**
- **Firebase Cloud Messaging (FCM)** → for push notifications
- **Nodemailer** → for email notifications
- **Socket.IO** → for real-time in-app notifications

### **Development Tools**
- **Jest** → for comprehensive testing
- **ESLint** and **Prettier** → for code quality
- **Nodemon** → for development hot-reloading
- **TypeScript** compilation and type checking

---

