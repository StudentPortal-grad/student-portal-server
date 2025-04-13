import { Schema, model, Types } from "mongoose";
import { IMessage } from "./types";

interface IAttachment {
    type: string;
    resource?: string;
    thread?: Types.ObjectId;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}

interface IReadEntry {
    userId: Types.ObjectId;
    readAt: Date;
}

interface IReaction {
    emoji: string;
    users: Types.ObjectId[];
}

interface _IForwardInfo {
    originalMessageId: Types.ObjectId;
    originalConversationId: Types.ObjectId;
    forwardedBy: Types.ObjectId;
    forwardedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
    {
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },
        content: {
            type: String,
        },
        attachments: [
            {
                _id: false,
                type: {
                    type: String,
                    enum: [
                        "document",
                        "file",
                        "poll",
                        "thread",
                        "image",
                        "video",
                        "audio",
                    ],
                },
                resource: String,
                fileName: String,
                fileSize: Number,
                mimeType: String,
                thread: {
                    type: Schema.Types.ObjectId,
                    ref: "Conversation",
                },
            },
        ],
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
        reactions: [
            {
                _id: false,
                emoji: String,
                users: [
                    {
                        type: Schema.Types.ObjectId,
                        ref: "Users",
                    },
                ],
            },
        ],
        mentions: [
            {
                type: Schema.Types.ObjectId,
                ref: "Users",
            },
        ],
        status: {
            type: String,
            enum: ["sent", "delivered", "read"],
            default: "sent",
        },
        readBy: [
            {
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: "Users",
                },
                readAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        isEdited: {
            type: Boolean,
            default: false,
        },
        editHistory: [
            {
                content: String,
                editedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        isPinned: {
            type: Boolean,
            default: false,
        },
        forwardInfo: {
            _id: false,
            originalMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
            originalConversationId: {
                type: Schema.Types.ObjectId,
                ref: "Conversation",
            },
            forwardedBy: { type: Schema.Types.ObjectId, ref: "Users" },
            forwardedAt: { type: Date, default: Date.now },
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Indexes
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ conversationId: 1 });
MessageSchema.index({ "attachments.thread": 1 });
MessageSchema.index({ createdAt: 1 });
MessageSchema.index({ mentions: 1 });
// Add this near other indexes
MessageSchema.index({ content: 'text' });

// Validate that either content or attachments are present
MessageSchema.pre("save", function (this: IMessage, next) {
    if (!this.content && (!this.attachments || this.attachments.length === 0)) {
        next(new Error("Message must have either content or attachments"));
    }
    next();
});

// Methods
MessageSchema.methods = {
    // Mark as read by a user
    markAsReadBy: async function (userId: Types.ObjectId): Promise<void> {
        const readEntry = this.readBy.find((entry: IReadEntry) =>
            entry.userId.equals(userId)
        );
        if (!readEntry) {
            this.readBy.push({ userId, readAt: new Date() });
            this.status = "read";
            await this.save();
        }
    },

    // Add reaction
    addReaction: async function (
        userId: Types.ObjectId,
        emoji: string
    ): Promise<void> {
        const reaction = this.reactions.find(
            (r: IReaction) => r.emoji === emoji
        );
        if (!reaction) {
            this.reactions.push({ emoji, users: [userId] });
        } else if (
            !reaction.users.some((u: Types.ObjectId) => u.equals(userId))
        ) {
            reaction.users.push(userId);
        }
        await this.save();
    },

    // Remove reaction
    removeReaction: async function (
        userId: Types.ObjectId,
        emoji: string
    ): Promise<void> {
        const reaction = this.reactions.find(
            (r: IReaction) => r.emoji === emoji
        );
        if (reaction) {
            reaction.users = reaction.users.filter(
                (u: Types.ObjectId) => !u.equals(userId)
            );
            if (reaction.users.length === 0) {
                this.reactions = this.reactions.filter(
                    (r: IReaction) => r.emoji !== emoji
                );
            }
            await this.save();
        }
    },

    // Edit message
    editMessage: async function (newContent: string): Promise<void> {
        if (this.content === newContent) return;

        if (!this.editHistory) this.editHistory = [];
        this.editHistory.push({
            content: this.content,
            editedAt: new Date(),
        });

        this.content = newContent;
        this.isEdited = true;
        await this.save();
    },

    // Add thread reply
    addThreadReply: async function (
        conversationId: Types.ObjectId
    ): Promise<void> {
        if (!this.attachments) this.attachments = [];
        this.attachments.push({
            type: "thread",
            thread: conversationId,
        });
        await this.save();
    },

    // Toggle pin status
    togglePin: async function (): Promise<void> {
        this.isPinned = !this.isPinned;
        await this.save();
    },

    // Check if message has thread
    hasThread: function (): boolean {
        return (
            this.attachments?.some(
                (att: IAttachment) => att.type === "thread"
            ) || false
        );
    },

    // Forward message to another conversation
    forwardTo: async function (
        targetConversationId: Types.ObjectId,
        userId: Types.ObjectId
    ): Promise<IMessage> {
        const MessageModel = model<IMessage>("Message");
        const forwardedMessage = new MessageModel({
            content: this.content,
            attachments: this.attachments,
            senderId: userId,
            conversationId: targetConversationId,
            forwardInfo: {
                originalMessageId: this._id,
                originalConversationId: this.conversationId,
                forwardedBy: userId,
            },
        });

        await forwardedMessage.save();
        return forwardedMessage;
    },
};

// Statics
MessageSchema.statics = {
    // Find unread messages for user
    findUnreadMessages: function (userId: Types.ObjectId) {
        return this.find({
            senderId: { $ne: userId },
            "readBy.userId": { $ne: userId },
        });
    },

    // Find pinned messages in conversation
    findPinnedMessages: function (conversationId: Types.ObjectId) {
        return this.find({
            conversationId,
            isPinned: true,
        }).sort({ createdAt: -1 });
    },

    // Find messages with mentions of user
    findMentions: function (userId: Types.ObjectId) {
        return this.find({
            mentions: userId,
        }).sort({ createdAt: -1 });
    },
};

export default model<IMessage>("Message", MessageSchema);
