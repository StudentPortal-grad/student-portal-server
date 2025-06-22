import mongoose from 'mongoose';
import { config } from '../config';
import { ChatbotService } from '../services/chatbot.service';
import User from '../models/User';

const initializeChatbotForUser = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error('Invalid user ID provided.');
    process.exit(1);
  }

  console.log(`Connecting to database at ${config.mongoose.url}...`);
  await mongoose.connect(config.mongoose.url);
  console.log('Database connected.');

  try {
    console.log(`Searching for user with ID: ${userId}`);
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User with ID ${userId} not found.`);
      return;
    }

    console.log(`Found user: ${user.name}. Initializing chatbot conversation...`);

    const conversation = await ChatbotService.createChatbotConversation(userId);

    if (conversation) {
      console.log(`Chatbot conversation created successfully for user ${user.name}.`);
      console.log(`Conversation ID: ${conversation._id}`);
    } else {
      console.error('Failed to create chatbot conversation.');
    }
  } catch (error) {
    console.error('An error occurred during chatbot initialization:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
};

const userId = "6849a12b5447c8e00a788811"
if (!userId) {
  console.error('Please provide a user ID as a command-line argument.');
  console.log('Usage: ts-node src/scripts/initializeChatbot.ts <userId>');
  process.exit(1);
}

initializeChatbotForUser(userId).catch(error => {
  console.error('Script failed with an unhandled error:', error);
  process.exit(1);
});
