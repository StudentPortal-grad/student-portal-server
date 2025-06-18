import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import { generateUsernameFromEmail } from '../utils/helpers';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.DB_URI;

if (!MONGODB_URI) {
    console.error('MongoDB connection string is not defined in .env file.');
    process.exit(1);
}

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connected successfully for migration.');
    } catch (err: any) {
        console.error(`MongoDB connection error: ${err.message}`);
        process.exit(1);
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('MongoDB disconnected successfully.');
    } catch (err: any) {
        console.error(`MongoDB disconnection error: ${err.message}`);
    }
};

const generateMissingUsernames = async () => {
    await connectDB();

    try {
        const usersToUpdate = await User.find({
            $or: [{ username: { $exists: false } }, { username: null }, { username: '' }],
        });

        if (usersToUpdate.length === 0) {
            console.log('No users found without a username. Migration not needed.');
            return;
        }

        console.log(`Found ${usersToUpdate.length} users without a username. Starting migration...`);

        let updatedCount = 0;
        for (const user of usersToUpdate) {
            let newUsername: string;
            let isUnique = false;

            while (!isUnique) {
                newUsername = generateUsernameFromEmail(user.email);
                const existingUser = await User.findOne({ username: newUsername });
                if (!existingUser) {
                    isUnique = true;
                }
            }

            user.username = newUsername!;
            await user.save({ validateBeforeSave: false }); // Bypass validation to avoid password hashing issues
            updatedCount++;
            console.log(`Updated username for user ${user.email} to ${user.username}`);
        }

        console.log(`Migration complete. Successfully updated ${updatedCount} users.`);
    } catch (error: any) {
        console.error(`An error occurred during the migration: ${error.message}`);
    } finally {
        await disconnectDB();
    }
};

generateMissingUsernames();
