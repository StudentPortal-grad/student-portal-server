#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User';
import { ChatbotService } from '../services/chatbot.service';
import Conversation from '../models/Conversation';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_URI = process.env.DB_URI;

async function migrate() {
    if (!DB_URI) {
        console.error('DB_URI is not defined in the .env file');
        process.exit(1);
    }

    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB');

        // Initialize the chatbot user
        console.log('Initializing chatbot user...');
        await ChatbotService.initializeChatbotUser();
        console.log('Chatbot user initialized successfully.');

        // Find all student users
        const students = await User.find({
            role: 'student',
            isChatbot: { $ne: true }
        });

        if (students.length === 0) {
            console.log('No student users found to check for chatbot conversations.');
            return;
        }

        console.log(`Found ${students.length} student users. Checking for existing conversations...`);

        let createdCount = 0;
        // Create chatbot conversations for each student who doesn't have one
        for (const student of students) {
            try {
                // Check if a chatbot conversation already exists for this user
                const existingConversation = await Conversation.findOne({
                    type: 'CHATBOT',
                    participants: student._id
                });

                if (existingConversation) {
                    console.log(`Conversation already exists for student: ${student.name} (${student.email})`);
                    // Optionally, ensure the user's flag is set correctly
                    if (!student.hasChatbotConversation) {
                        await User.updateOne({ _id: student._id }, { hasChatbotConversation: true });
                        console.log(`Updated 'hasChatbotConversation' flag for ${student.name}`);
                    }
                    continue;
                }

                console.log(`Creating chatbot conversation for student: ${student.name} (${student.email})`);
                await ChatbotService.createChatbotConversation(student._id.toString());
                createdCount++;
                console.log(`Successfully created conversation for ${student.name}`);
            } catch (error) {
                console.error(`Failed to create conversation for ${student.name}:`, error);
            }
        }

        console.log(`Migration completed. Created ${createdCount} new chatbot conversations.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrate();
