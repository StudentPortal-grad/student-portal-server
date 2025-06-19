import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Conversation from '../models/Conversation';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.DB_URI;
const CHATBOT_IMAGE_URL = 'https://res.cloudinary.com/dkmo7c9hr/image/upload/v1749933120/student_portal/chatbot/kpjqsw2zjul2qnxcstrm.png';

const migrateChatbotGroupImage = async () => {
    if (!MONGODB_URI) {
        console.error('Error: MONGODB_URI is not defined in the .env file.');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connected successfully.');

        console.log('Starting migration: Updating groupImage for all CHATBOT conversations...');

        const result = await Conversation.updateMany(
            { type: 'CHATBOT' },
            { $set: { groupImage: CHATBOT_IMAGE_URL } }
        );

        console.log(`Migration completed. Matched ${result.matchedCount} documents and modified ${result.modifiedCount} documents.`);

    } catch (error) {
        console.error('An error occurred during the migration:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('MongoDB connection closed.');
        }
    }
};

migrateChatbotGroupImage();
