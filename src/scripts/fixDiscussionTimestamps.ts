import mongoose from "mongoose";
import dotenv from "dotenv";
import Discussion from "../models/Discussion";

dotenv.config({ path: "./.env" });

const fixDiscussionTimestamps = async () => {
    try {
        const mongoUri = process.env.DB_URI;
        if (!mongoUri) {
            console.error("DB_URI not found in environment variables.");
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully.");

        const now = new Date();
        const result = await Discussion.updateMany(
            { createdAt: { $exists: false } },
            { $set: { createdAt: now, updatedAt: now } }
        );

        if (result.matchedCount === 0) {
            console.log("No discussions found that need timestamp fixes.");
            return;
        }

        console.log(`Successfully updated ${result.modifiedCount} discussions with timestamps.`);

    } catch (error) {
        console.error("An error occurred while fixing discussion timestamps:", error);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
};

fixDiscussionTimestamps();
