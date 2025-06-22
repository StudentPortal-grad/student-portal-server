import { httpServer } from './config/app';
import { config } from './config';
import connection from './config/db';
import agenda from './config/agenda';
import { defineNotificationJobs } from './jobs/notificationJobs';
import { defineRecommendationJobs } from './jobs/recommendationJobs';

const port = config.port;

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // In a real app, you'd want more robust error handling and possibly a graceful shutdown
  process.exit(1);
});

const startServer = async () => {
  // 1. Connect to the database
  await connection();

  // 2. Define Agenda jobs
  defineNotificationJobs(agenda);
  defineRecommendationJobs(agenda);

  // 3. Start Agenda scheduler
  await agenda.start();
  // Schedule the recommendation system initialization job to run now
  await agenda.now('initialize-recommendation-system', {});
  console.log('[server]: Agenda scheduler started.');

  // 4. Start the HTTP server
  httpServer.listen(port, () => {
    console.log(`[server]: Server is running on port ${port}`);
  });
};

// Graceful shutdown logic
const gracefulShutdown = async () => {
  console.log('[server]: Received kill signal, shutting down gracefully...');
  await agenda.stop();
  console.log('[server]: Agenda stopped.');
  process.exit(0);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer().catch((error) => {
  console.error('[server]: Failed to start server:', error);
  process.exit(1);
});

