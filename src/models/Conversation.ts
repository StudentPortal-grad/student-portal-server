import { Schema, model, Types } from "mongoose";
import { IConversation, IConversationModel } from "./types";

interface IParticipant {
    userId: Types.ObjectId;
    role: string;
    joinedAt: Date;
    lastSeen: Date;
    isAdmin: boolean;
}

const ConversationSchema = new Schema<IConversation>(
    {
        type: {
            type: String,
            required: true,
            enum: ["DM", "GroupDM"],
        },
        participants: [
            {
                _id: false,
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: "Users",
                    required: true,
                },
                role: {
                    type: String,
                    enum: ["owner", "admin", "member"],
                    default: "member",
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
                lastSeen: {
                    type: Date,
                    default: Date.now,
                },
                isAdmin: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        name: {
            type: String,
            maxlength: 255,
            trim: true,
        },
        description: {
            type: String,
            maxlength: 1000,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
        pinnedMessages: [
            {
                type: Schema.Types.ObjectId,
                ref: "Message",
            },
        ],
        inviteLink: {
            type: String,
            maxlength: 500,
        },
        status: {
            type: String,
            enum: ["active", "archived", "deleted"],
            default: "active",
        },
        groupImage: {
            type: String,
        },
        settings: {
            onlyAdminsCanPost: {
                type: Boolean,
                default: false,
            },
            onlyAdminsCanAddMembers: {
                type: Boolean,
                default: false,
            },
            onlyAdminsCanPinMessages: {
                type: Boolean,
                default: true,
            },
            slowMode: {
                enabled: {
                    type: Boolean,
                    default: false,
                },
                interval: {
                    type: Number,
                    default: 0,
                },
            },
        },
        metadata: {
            totalMessages: {
                type: Number,
                default: 0,
            },
            lastActivity: {
                type: Date,
                default: Date.now,
            },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
ConversationSchema.index({ "participants.userId": 1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ createdAt: 1 });
ConversationSchema.index({ "metadata.lastActivity": 1 });

// Validate minimum participants for GroupDM
ConversationSchema.pre("save", function (next) {
    if (this.type === "GroupDM" && this.participants.length < 2) {
        next(new Error("GroupDM must have at least 2 participants"));
    }
    next();
});

// Methods
ConversationSchema.methods = {
    // Add participant with role
    addParticipant: async function (
        userId: Types.ObjectId,
        role: string = "member"
    ): Promise<void> {
        if (
            this.type === "GroupDM" &&
            !this.participants.some((p: IParticipant) =>
                p.userId.equals(userId)
            )
        ) {
            this.participants.push({
                userId,
                role,
                joinedAt: new Date(),
                lastSeen: new Date(),
                isAdmin: role === "admin" || role === "owner",
            });
            await this.save();
        }
    },

    // Remove participant
    removeParticipant: async function (userId: Types.ObjectId): Promise<void> {
        if (this.type === "GroupDM") {
            const isLastAdmin =
                this.participants.filter((p: IParticipant) => p.isAdmin)
                    .length === 1 &&
                this.participants.find((p: IParticipant) =>
                    p.userId.equals(userId)
                )?.isAdmin;

            if (isLastAdmin) {
                throw new Error("Cannot remove the last admin from the group");
            }

            this.participants = this.participants.filter(
                (p: IParticipant) => !p.userId.equals(userId)
            );
            await this.save();
        }
    },

    // Update participant role
    updateParticipantRole: async function (
        userId: Types.ObjectId,
        newRole: string
    ): Promise<void> {
        const participant = this.participants.find((p: IParticipant) =>
            p.userId.equals(userId)
        );
        if (participant) {
            participant.role = newRole;
            participant.isAdmin = newRole === "admin" || newRole === "owner";
            await this.save();
        }
    },

    // Update last seen
    updateLastSeen: async function (userId: Types.ObjectId): Promise<void> {
        const participant = this.participants.find((p: IParticipant) =>
            p.userId.equals(userId)
        );
        if (participant) {
            participant.lastSeen = new Date();
            await this.save();
        }
    },

    // Add message and update metadata
    addMessage: async function (messageId: Types.ObjectId): Promise<void> {
        if (!this.messages) this.messages = [];
        this.messages.push(messageId);
        this.lastMessage = messageId;
        this.metadata.totalMessages += 1;
        this.metadata.lastActivity = new Date();
        await this.save();
    },

    // Pin/Unpin message
    togglePinMessage: async function (
        messageId: Types.ObjectId
    ): Promise<void> {
        const isPinned = this.pinnedMessages?.includes(messageId);
        if (isPinned) {
            this.pinnedMessages = this.pinnedMessages.filter(
                (id: Types.ObjectId) => !id.equals(messageId)
            );
        } else {
            if (!this.pinnedMessages) this.pinnedMessages = [];
            this.pinnedMessages.push(messageId);
        }
        await this.save();
    },

    // Generate invite link for group
    generateInviteLink: async function (): Promise<string | null> {
        if (this.type === "GroupDM") {
            const uniqueId = new Types.ObjectId().toString();
            this.inviteLink = `https://studentportal.com/chat/join/${uniqueId}`;
            await this.save();
            return this.inviteLink;
        }
        return null;
    },

    // Check if user is admin
    isUserAdmin: function (userId: Types.ObjectId): boolean {
        return this.participants.some(
            (p: IParticipant) => p.userId.equals(userId) && p.isAdmin
        );
    },

    // Get unread messages count for user
    getUnreadCount: async function (userId: Types.ObjectId): Promise<number> {
        const lastSeen = this.participants.find((p: IParticipant) =>
            p.userId.equals(userId)
        )?.lastSeen;

        if (!lastSeen) return 0;

        return this.model("Message").countDocuments({
            conversationId: this._id,
            createdAt: { $gt: lastSeen },
            senderId: { $ne: userId },
        });
    },
};

// Add to the static methods
ConversationSchema.statics = {
    // Find or create a DM conversation between two users
    findOrCreateDM: async function (
        participant1Id: Types.ObjectId,
        participant2Id: Types.ObjectId
    ): Promise<IConversation> {
        // First, check if a DM already exists between these users
        const existingDM = await this.findOne({
            type: "DM",
            "participants.userId": { $all: [participant1Id, participant2Id] },
            status: "active",
        });

        if (existingDM) {
            return existingDM;
        }

        // Create a new DM conversation
        const newDM = await this.create({
            type: "DM",
            participants: [
                { userId: participant1Id, role: "member" },
                { userId: participant2Id, role: "member" },
            ],
            createdBy: participant1Id,
            status: "active",
        });

        // Update both users' friend records with the conversation ID
        const User = model("Users");
        await User.findOneAndUpdate(
            { _id: participant1Id, "friends.userId": participant2Id },
            { $set: { "friends.$.conversationId": newDM._id } }
        );

        await User.findOneAndUpdate(
            { _id: participant2Id, "friends.userId": participant1Id },
            { $set: { "friends.$.conversationId": newDM._id } }
        );

        return newDM;
    },

    // Find active conversations for a user
    findActiveConversations: async function (
        userId: Types.ObjectId
    ): Promise<IConversation[]> {
        return this.find({
            "participants.userId": userId,
            status: "active",
        })
            .populate(
                "participants.userId",
                "name profilePicture status socketId"
            )
            .populate("lastMessage")
            .sort({ "metadata.lastActivity": -1 });
    },

    // Find group conversations where user is admin
    findAdminGroups: async function (userId: Types.ObjectId) {
        return this.find({
            type: "GroupDM",
            participants: {
                $elemMatch: {
                    userId: userId,
                    isAdmin: true,
                },
            },
        });
    },
};

// Update the model export line at the bottom of the file
export default model<IConversation, IConversationModel>(
    "Conversation",
    ConversationSchema
);
