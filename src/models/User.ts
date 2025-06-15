import { Schema, model, Types } from "mongoose";
import { IUser } from "./types";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/* global process */
interface IFriendship {
    userId: Types.ObjectId;
    status: "pending" | "accepted" | "blocked";
    blockedBy?: Types.ObjectId;
    createdAt: Date;
}

interface IChatSettings {
    notifications: "all" | "mentions" | "none";
    soundEnabled: boolean;
    desktopNotifications: boolean;
    showTypingIndicators: boolean;
    markReadOnView: boolean;
    theme: "light" | "dark" | "system";
}

const UserSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            maxlength: 255,
        },
        username: {
            type: String,
            required: false,
            trim: true,
            minlength: [3, "Username must be at least 3 characters long"],
            maxlength: [30, "Username cannot exceed 30 characters"],
        },
        gender: {
            type: String,
            required: false,
            enum: ["male", "female"],
        },
        phoneNumber: {
            type: String,
            required: false,
            validate: {
                validator: function (v: string) {
                    return /^\+\d{1,4}[\s-]?(\d[\s-]?){6,14}\d$/.test(v);
                },
                message: (props) =>
                    `${props.value} is not a valid international phone number!`,
            },
        },
        dateOfBirth: {
            type: Date,
        },
        university: {
            type: String,
            required: function (this: IUser) {
                return this.signupStep === "completed" && !this.isChatbot;
            },
        },
        college: {
            type: String,
            required: function (this: IUser) {
                return this.signupStep === "completed" && !this.isChatbot;
            },
        },
        email: {
            type: String,
            required: true,
            unique: true,
            maxlength: 320,
        },
        password: {
            type: String,
            required: function (this: IUser) {
                return !this.isChatbot;
            },
            maxlength: 60,
            minlength: 8,
            select: false,
        },
        signupStep: {
            type: String,
            required: true,
            enum: ["initial", "verified", "completed"],
            default: "initial",
        },
        role: {
            type: String,
            required: function (this: IUser) {
                return this.signupStep === "completed";
            },
            enum: ["student", "faculty", "admin", "superadmin"],
        },
        profilePicture: {
            type: String,
            default: "https://via.placeholder.com/150",
        },
        profile: {
            bio: String,
            interests: [String],
        },
        addresses: [
            {
                _id: false,
                street: String,
                city: String,
                country: String,
            },
        ],
        level: {
            type: Number,
            min: 1,
            max: 5,
        },
        gpa: {
            type: Number,
        },
        universityEmail: {
            type: String,
            maxlength: 320,
        },
        universityEmailVerified: {
            type: Boolean,
            default: false,
        },
        tempEmail: {
            type: String,
            select: false,
        },
        tempUniversityEmail: {
            type: String,
            select: false,
        },
        mfa_settings: {
            enabled: {
                type: Boolean,
                default: false,
            },
            methods: [String],
        },
        dashboards: {
            academic_progress: Number,
            event_stats: {
                attended: Number,
            },
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        otp: {
            code: String,
            expiresAt: Date,
        },
        roles: [
            {
                _id: false,
                communityId: {
                    type: Schema.Types.ObjectId,
                    ref: "Community",
                },
                role: String,
            },
        ],
        status: {
            type: String,
            enum: ["online", "offline", "idle", "dnd"],
            default: "offline",
        },
        isSuspended: {
            type: Boolean,
            default: false,
        },
        suspensionReason: {
            type: String,
        },
        suspendedUntil: {
            type: Date,
        },
        socketId: {
            type: String,
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        isGraduated: {
            type: Boolean,
            default: false,
        },
        graduationYear: {
            type: Number,
            validate: {
                validator: function (v: number) {
                    return v >= 1900 && v <= new Date().getFullYear();
                },
                message:
                    "Graduation year must be between 1900 and current year",
            },
        },
        // Add to the friends array schema to include conversationId
        friends: [
            {
                _id: false,
                userId: { type: Schema.Types.ObjectId, ref: "Users" },
                status: {
                    type: String,
                    enum: ["pending", "accepted", "blocked"],
                    default: "pending",
                },
                blockedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "Users",
                },
                conversationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Conversation",
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        friendRequests: [
            {
                _id: false,
                userId: { type: Schema.Types.ObjectId, ref: "Users" },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        recentConversations: [
            {
                _id: false,
                conversationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Conversation",
                },
                unreadCount: { type: Number, default: 0 },
                lastReadMessageId: {
                    type: Schema.Types.ObjectId,
                    ref: "Message",
                },
                isPinned: { type: Boolean, default: false },
                isMuted: { type: Boolean, default: false },
                mutedUntil: Date,
            },
        ],
        chatPreferences: {
            notifications: {
                type: String,
                enum: ["all", "mentions", "none"],
                default: "all",
            },
            soundEnabled: {
                type: Boolean,
                default: true,
            },
            desktopNotifications: {
                type: Boolean,
                default: true,
            },
            showTypingIndicators: {
                type: Boolean,
                default: true,
            },
            markReadOnView: {
                type: Boolean,
                default: true,
            },
            theme: {
                type: String,
                enum: ["light", "dark", "system"],
                default: "system",
            },
        },
        mutedConversations: [
            {
                _id: false,
                conversationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Conversation",
                },
                mutedUntil: Date,
            },
        ],
        pinnedConversations: [
            {
                type: Schema.Types.ObjectId,
                ref: "Conversation",
            },
        ],
        bookmarkedMessages: [
            {
                _id: false,
                messageId: { type: Schema.Types.ObjectId, ref: "Message" },
                conversationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Conversation",
                },
                bookmarkedAt: { type: Date, default: Date.now },
                note: String,
            },
        ],
        fcmToken: {
            type: String,
            default: null,
        },
        // Chatbot specific fields
        isChatbot: {
            type: Boolean,
            default: false,
        },
        botSettings: {
            type: {
                isActive: { type: Boolean, default: true },
                language: { type: String, enum: ['ar', 'en'], default: 'ar' },
                personalityType: { type: String, enum: ['formal', 'friendly', 'academic'], default: 'academic' },
                contextLimit: { type: Number, default: 10 }
            },
            default: null
        },
        hasChatbotConversation: {
            type: Boolean,
            default: false,
        },
        chatbotConversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            default: null
        }
    },
    {
        timestamps: true,
    }
);

// Indexes
UserSchema.index({ universityEmail: 1 }, { sparse: true, unique: true });
UserSchema.index(
    { username: 1 },
    {
        unique: true,
        sparse: true,
        collation: { locale: "en", strength: 2 }, // Case-insensitive unique index
    }
);

// Add index for friends and muted conversations
UserSchema.index({ "friends.userId": 1 });
UserSchema.index({ "mutedConversations.conversationId": 1 });

// Add text index for searching
UserSchema.index({ name: 'text', username: 'text', universityEmail: 'text' });

// Pre-save middleware for password validation and hashing
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    try {
        // Validate password before hashing
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
        if (!passwordRegex.test(this.password)) {
            throw new Error(
                "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)"
            );
        }

        // Hash password if validation passes
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Methods
UserSchema.methods = {
    // Generate JWT token
    generateAuthToken: function (): string {
        return jwt.sign(
            { id: this._id, role: this.role },
            process.env.JWT_SECRET || "li11kgF62d9SyoW8AV72f3ltzKv/WSk8wVIE5xxvSRg=",
            { expiresIn: "24h" }
        );
    },

    // Compare password
    comparePassword: async function (
        candidatePassword: string
    ): Promise<boolean> {
        return bcrypt.compare(candidatePassword, this.password);
    },

    // Generate password reset token
    generateResetToken: async function (): Promise<string> {
        const resetToken = crypto.randomBytes(32).toString("hex");
        this.otp = {
            code: crypto.createHash("sha256").update(resetToken).digest("hex"),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        };
        await this.save({ validateBeforeSave: false });
        return resetToken;
    },

    // Update online status
    updateStatus: async function (
        status: "online" | "offline" | "idle" | "dnd"
    ): Promise<void> {
        this.status = status;
        await this.save({ validateBeforeSave: false });
    },

    // Friend management
    addFriend: async function (userId: Types.ObjectId): Promise<void> {
        if (!this.friends?.some((f: IFriendship) => f.userId.equals(userId))) {
            this.friends.push({
                userId,
                status: "pending",
                createdAt: new Date(),
            });
            await this.save({ validateBeforeSave: false });
        }
    },

    // Update the acceptFriend method to include conversationId
    acceptFriend: async function (
        userId: Types.ObjectId,
        conversationId?: Types.ObjectId
    ): Promise<void> {
        const friendship = this.friends?.find((f: IFriendship) =>
            f.userId.equals(userId)
        );
        if (friendship && friendship.status === "pending") {
            friendship.status = "accepted";
            if (conversationId) {
                friendship.conversationId = conversationId;
            }
            await this.save({ validateBeforeSave: false });
        }
    },

    // Add a method to set conversation for a friend
    setFriendConversation: async function (
        userId: Types.ObjectId,
        conversationId: Types.ObjectId
    ): Promise<void> {
        const friendship = this.friends?.find((f: IFriendship) =>
            f.userId.equals(userId)
        );
        if (friendship) {
            friendship.conversationId = conversationId;
            await this.save({ validateBeforeSave: false });
        }
    },

    // Add a method to get a friend's conversation
    getFriendConversation: function (
        userId: Types.ObjectId
    ): Types.ObjectId | null {
        const friendship = this.friends?.find((f: IFriendship) =>
            f.userId.equals(userId)
        );
        return friendship?.conversationId || null;
    },

    blockUser: async function (userId: Types.ObjectId): Promise<void> {
        const friendship = this.friends?.find((f: IFriendship) =>
            f.userId.equals(userId)
        );
        if (!friendship) {
            this.friends.push({
                userId,
                status: "blocked",
                blockedBy: this._id,
                createdAt: new Date(),
            });
        } else {
            friendship.status = "blocked";
            friendship.blockedBy = this._id;
        }
        await this.save({ validateBeforeSave: false });
    },

    // Conversation management
    updateConversationStatus: async function (
        conversationId: Types.ObjectId,
        updates: {
            unreadCount?: number;
            lastReadMessageId?: Types.ObjectId;
            isPinned?: boolean;
            isMuted?: boolean;
            mutedUntil?: Date;
        }
    ): Promise<void> {
        const conversation = this.recentConversations?.find(
            (c: { conversationId: Types.ObjectId }) =>
                c.conversationId.equals(conversationId)
        );

        if (!conversation) {
            this.recentConversations.push({
                conversationId,
                unreadCount: 0,
                isPinned: false,
                isMuted: false,
            });
        } else {
            Object.assign(conversation, updates);
        }
        await this.save({ validateBeforeSave: false });
    },

    // Chat settings
    updateChatSettings: async function (
        settings: Partial<IChatSettings>
    ): Promise<void> {
        this.chatSettings = {
            ...this.chatSettings,
            ...settings,
        };
        await this.save({ validateBeforeSave: false });
    },

    // Mute conversation
    muteConversation: async function (
        conversationId: Types.ObjectId,
        duration?: number
    ): Promise<void> {
        const mutedUntil =
            duration ? new Date(Date.now() + duration) : undefined;

        if (!this.mutedConversations) {
            this.mutedConversations = [];
        }

        const existingMute = this.mutedConversations.find(
            (mute: { conversationId: Types.ObjectId; mutedUntil?: Date }) =>
                mute.conversationId.equals(conversationId)
        );

        if (existingMute) {
            existingMute.mutedUntil = mutedUntil;
        } else {
            this.mutedConversations.push({ conversationId, mutedUntil });
        }

        await this.save({ validateBeforeSave: false });
    },

    // Pin/Unpin conversation
    togglePinConversation: async function (
        conversationId: Types.ObjectId
    ): Promise<void> {
        if (!this.pinnedConversations) {
            this.pinnedConversations = [];
        }

        const isPinned = this.pinnedConversations.some((id: Types.ObjectId) =>
            id.equals(conversationId)
        );

        if (isPinned) {
            this.pinnedConversations = this.pinnedConversations.filter(
                (id: Types.ObjectId) => !id.equals(conversationId)
            );
        } else {
            this.pinnedConversations.push(conversationId);
        }

        await this.save({ validateBeforeSave: false });
    },

    // Check if conversation is muted
    isConversationMuted: function (conversationId: Types.ObjectId): boolean {
        const mute = this.mutedConversations?.find(
            (m: { conversationId: Types.ObjectId; mutedUntil?: Date }) =>
                m.conversationId.equals(conversationId)
        );
        if (!mute) return false;
        if (!mute.mutedUntil) return true;
        return mute.mutedUntil > new Date();
    },

    // Get friend status
    getFriendStatus: function (userId: Types.ObjectId): string | null {
        const friend = this.friends?.find((f: IFriendship) =>
            f.userId.equals(userId)
        );
        return friend?.status || null;
    },

    // Bookmark management
    bookmarkMessage: async function (
        messageId: Types.ObjectId,
        conversationId: Types.ObjectId,
        note?: string
    ): Promise<void> {
        if (
            !this.bookmarkedMessages?.some((b: { messageId: Types.ObjectId }) =>
                b.messageId.equals(messageId)
            )
        ) {
            if (!this.bookmarkedMessages) this.bookmarkedMessages = [];
            this.bookmarkedMessages.push({
                messageId,
                conversationId,
                bookmarkedAt: new Date(),
                note,
            });
            await this.save({ validateBeforeSave: false });
        }
    },

    removeBookmark: async function (messageId: Types.ObjectId): Promise<void> {
        if (this.bookmarkedMessages) {
            this.bookmarkedMessages = this.bookmarkedMessages.filter(
                (b: { messageId: Types.ObjectId }) =>
                    !b.messageId.equals(messageId)
            );
            await this.save({ validateBeforeSave: false });
        }
    },

    updateBookmarkNote: async function (
        messageId: Types.ObjectId,
        note: string
    ): Promise<void> {
        const bookmark = this.bookmarkedMessages?.find(
            (b: { messageId: Types.ObjectId }) => b.messageId.equals(messageId)
        );
        if (bookmark) {
            bookmark.note = note;
            await this.save({ validateBeforeSave: false });
        }
    },
};

// Statics
UserSchema.statics = {
    // Find by email (either regular or university)
    findByEmail: function (email: string) {
        return this.findOne({
            $or: [{ email }, { universityEmail: email }],
        });
    },

    // Find online users
    findOnlineUsers: function () {
        return this.find({ status: "online" }).select("name status");
    },

    // Find users with active chat status
    findActiveUsers: function () {
        return this.find({
            status: { $in: ["online", "idle"] },
        }).select("name status lastSeen");
    },

    // Find user's friends
    findFriends: function (userId: Types.ObjectId) {
        return this.findOne({ _id: userId })
            .populate({
                path: "friends.userId",
                match: { "friends.status": "accepted" },
                select: "name profilePicture status",
            })
            .select("friends");
    },

    findRecentConversations: function (userId: Types.ObjectId) {
        return this.findOne({ _id: userId })
            .populate({
                path: "recentConversations.conversationId",
                populate: {
                    path: "lastMessage",
                    select: "content createdAt",
                },
            })
            .select("recentConversations")
            .sort({ "recentConversations.lastMessage.createdAt": -1 });
    },

    findBookmarkedMessages: function (userId: Types.ObjectId) {
        return this.findOne({ _id: userId })
            .populate({
                path: "bookmarkedMessages.messageId",
                select: "content attachments senderId createdAt",
            })
            .populate({
                path: "bookmarkedMessages.conversationId",
                select: "name type",
            })
            .select("bookmarkedMessages")
            .sort({ "bookmarkedMessages.bookmarkedAt": -1 });
    },
};

export default model<IUser>("Users", UserSchema);
