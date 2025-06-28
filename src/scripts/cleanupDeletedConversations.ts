import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User";

// Load environment variables from the root of the project
dotenv.config({ path: "./.env" });

const cleanupUserData = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.DB_URI;
        if (!mongoUri) {
            console.error("MONGO_URI not found in environment variables.");
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully.");

        // Fields to clear, as all conversations and messages were deleted
        const updateQuery = {
            $set: {
                recentConversations: [],
                pinnedConversations: [],
                mutedConversations: [],
                bookmarkedMessages: [],
                chatbotConversation: null,
                activeConvIds: [],
                hasChatbotConversation: false,
            },
            $unset: {
                chatbotConversationId: "",
                "friends.$[].conversationId": "",
            },
        };

        // Update all users in the database
        const result = await User.updateMany({}, updateQuery);

        console.log("Cleanup script finished successfully.");
        console.log(`- ${result.matchedCount} users found in the database.`);
        console.log(`- ${result.modifiedCount} users were updated.`);
    } catch (error) {
        console.error("An error occurred during the cleanup script:", error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
};

// Run the cleanup script
cleanupUserData();
