# Project Summary: Student Portal Server

This document provides a high-level overview of the major components and technologies used in the Student Portal Server backend.

## Core Architecture

The backend is built on a modern, robust technology stack designed for scalability and maintainability.

-   **Runtime/Framework**: Node.js with the Express.js framework.
-   **Language**: TypeScript is used across the project to ensure type safety and improve the developer experience.
-   **Database**: MongoDB serves as the primary database, with Mongoose used as the Object Data Modeler (ODM) for interacting with the database.
-   **Real-time Communication**: Socket.IO is integrated for real-time features, such as chat and notifications.

## Key Features & Components

### 1. Authentication & Security

A comprehensive security model is in place to protect user data and control access.

-   **Authentication**: Stateless authentication is handled using JSON Web Tokens (JWT).
-   **Password Security**: User passwords are securely hashed using `bcrypt`.
-   **Third-Party Integration**: OAuth 2.0 is implemented for secure integration with services like Google Calendar.
-   **API Protection**: Standard security measures like CORS, Helmet for security headers, and rate limiting are enforced to protect API endpoints.

### 2. File Handling

The system supports robust file uploads and cloud storage.

-   **Uploads**: `Multer` is used to handle multipart/form-data for file uploads.
-   **Cloud Storage**: Cloudinary is the primary cloud storage provider for media files, offering powerful image and video processing capabilities.

### 3. Real-time Services (Socket.IO)

The application includes several real-time features powered by Socket.IO:

-   **Live Chat**: Direct messaging and group chat functionalities.
-   **Notifications**: Real-time notifications for various application events.
-   **Presence System**: Tracking user online/offline status.

### 4. Chatbot Service

An intelligent chatbot is integrated to assist users.

-   **AI Integration**: The chatbot leverages an external AI API to understand and respond to user queries.
-   **Conversation Management**: The service manages chat history and context for personalized interactions.

### 5. Modular Structure

The codebase is organized into a modular structure for clarity and separation of concerns:

-   `controllers/`: Handle incoming requests and business logic.
-   `services/`: Contain core business logic, separated from the request/response cycle.
-   `models/`: Define Mongoose schemas and TypeScript types.
-   `repositories/`: Abstract database interactions.
-   `routes/`: Define API endpoints.
-   `middlewares/`: Custom middleware for authentication, validation, etc.
-   `utils/`: Utility functions and helper classes.
-   `validations/`: Input validation schemas.

### 6. Testing

The project emphasizes code quality and reliability through a comprehensive testing strategy.

-   **Framework**: Jest is used as the primary testing framework.
-   **Unit & Integration Tests**: The `__tests__` directory contains unit and integration tests for services, controllers, and other components.
-   **Mocking**: Jest's mocking capabilities are used extensively to isolate components and mock dependencies like databases and external services.
