import { Document, Model, Types } from "mongoose";

export interface IChatPreferences {
    messageNotifications: "all" | "mentions" | "none";
    soundEnabled: boolean;
    desktopNotifications: boolean;
    showTypingIndicators: boolean;
    markReadOnView: boolean;
    theme: "light" | "dark" | "system";
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    username: string;
    gender: "male" | "female";
    phoneNumber: string;
    dateOfBirth: Date;
    university: string;
    college: string;
    email: string;
    password: string;
    role: "student" | "faculty" | "admin" | "superadmin";
    signupStep: "initial" | "verified" | "password_set" | "completed";
    profilePicture: string;
    profile?: {
        bio?: string;
        interests?: string[];
    };
    addresses?: {
        street?: string;
        city?: string;
        country?: string;
    }[];
    friends?: {
        userId: Types.ObjectId;
        messageId: Types.ObjectId;
        conversationId: Types.ObjectId;
        status: "active" | "blocked" | "muted";
        lastInteractionAt: Date;
    }[];
    friendRequests?: {
        userId: Types.ObjectId;
        createdAt: Date;
    }[];
    level: number;
    gpa?: number;
    universityEmail?: string;
    mfa_settings?: {
        enabled: boolean;
        methods: string[];
    };
    dashboards?: {
        academic_progress?: number;
        event_stats?: {
            attended: number;
        };
    };
    emailVerified: boolean;
    otp?: {
        code: string;
        expiresAt: Date;
    };
    roles?: {
        communityId: Types.ObjectId;
        role: string;
    }[];
    status: "online" | "offline" | "idle" | "dnd";
    isSuspended: boolean;
    suspensionReason?: string;
    suspendedUntil?: Date;
    socketId?: string;
    lastSeen: Date;
    isGraduated?: boolean;
    graduationYear?: number;
    tempEmail?: string;
    tempUniversityEmail?: string;
    universityEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    chatPreferences: IChatPreferences;
    recentConversations?: {
        conversationId: Types.ObjectId;
        unreadCount: number;
        lastReadMessageId?: Types.ObjectId;
        isPinned: boolean;
        isMuted: boolean;
        mutedUntil?: Date;
    }[];
    mutedConversations?: {
        conversationId: Types.ObjectId;
        mutedUntil?: Date;
    }[];
    pinnedConversations?: Types.ObjectId[];
    bookmarkedMessages?: {
        messageId: Types.ObjectId;
        conversationId: Types.ObjectId;
        bookmarkedAt: Date;
        note?: string;
    }[];

    // Instance methods
    generateAuthToken(): string;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateResetToken(): Promise<string>;
    updateStatus(status: "online" | "offline" | "idle" | "dnd"): Promise<void>;
    blockFriend(friendId: Types.ObjectId): Promise<void>;
    muteFriend(friendId: Types.ObjectId): Promise<void>;
    muteConversation(
        conversationId: Types.ObjectId,
        duration?: number
    ): Promise<void>;
    togglePinConversation(conversationId: Types.ObjectId): Promise<void>;
    updateChatPreferences(
        preferences: Partial<IChatPreferences>
    ): Promise<void>;
    isConversationMuted(conversationId: Types.ObjectId): boolean;
    getFriendStatus(userId: Types.ObjectId): string | null;
}

export interface IConversation extends Document {
    type: "DM" | "GroupDM";
    participants: {
        userId: Types.ObjectId;
        role: "owner" | "admin" | "member";
        joinedAt: Date;
        lastSeen: Date;
        isAdmin: boolean;
    }[];
    name?: string;
    description?: string;
    createdBy: Types.ObjectId;
    messages?: Types.ObjectId[];
    lastMessage?: Types.ObjectId;
    pinnedMessages?: Types.ObjectId[];
    inviteLink?: string;
    status: "active" | "archived" | "deleted";
    groupImage?: string;
    settings: {
        onlyAdminsCanPost: boolean;
        onlyAdminsCanAddMembers: boolean;
        onlyAdminsCanPinMessages: boolean;
        slowMode: {
            enabled: boolean;
            interval: number;
        };
    };
    metadata: {
        totalMessages: number;
        lastActivity: Date;
    };
    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    addParticipant(userId: Types.ObjectId, role?: string): Promise<void>;
    removeParticipant(userId: Types.ObjectId): Promise<void>;
    updateParticipantRole(
        userId: Types.ObjectId,
        newRole: string
    ): Promise<void>;
    updateLastSeen(userId: Types.ObjectId): Promise<void>;
    addMessage(messageId: Types.ObjectId): Promise<void>;
    togglePinMessage(messageId: Types.ObjectId): Promise<void>;
    generateInviteLink(): Promise<string | null>;
    isUserAdmin(userId: Types.ObjectId): boolean;
    getUnreadCount(userId: Types.ObjectId): Promise<number>;
}

export interface IMessage extends Document {
    senderId: Types.ObjectId;
    conversationId: Types.ObjectId;
    content?: string;
    attachments?: {
        type:
            | "document"
            | "file"
            | "poll"
            | "thread"
            | "image"
            | "video"
            | "audio";
        resource?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        thread?: Types.ObjectId;
    }[];
    replyTo?: Types.ObjectId;
    reactions?: {
        emoji: string;
        users: Types.ObjectId[];
    }[];
    mentions?: Types.ObjectId[];
    status: "sent" | "delivered" | "read";
    readBy: {
        userId: Types.ObjectId;
        readAt: Date;
    }[];
    isEdited: boolean;
    editHistory?: {
        content: string;
        editedAt: Date;
    }[];
    isPinned: boolean;
    forwardInfo?: {
        originalMessageId: Types.ObjectId;
        originalConversationId: Types.ObjectId;
        forwardedBy: Types.ObjectId;
        forwardedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface INotification extends Document {
    userId: Types.ObjectId;
    type: string;
    content: string;
    status: "read" | "unread";
    timestamp: Date;
    metadata?: {
        event_id?: Types.ObjectId;
        [key: string]: any;
    };
}

export interface IAttachment {
    type: 'document' | 'image' | 'video' | 'audio' | 'pdf' | 'other' | 'poll';
    resource: string;
    mimeType: string;
    originalFileName: string;
    fileSize: number;
    checksum: string;
}

export interface IVote {
    userId: Types.ObjectId;
    voteType: 'upvote' | 'downvote';
    createdAt: Date;
}

export interface IReport {
    userId: Types.ObjectId;
    reason: string;
    createdAt: Date;
}

export interface IReply extends Document {
    content: string;
    creator: Types.ObjectId;
    attachments: IAttachment[];
    votes: IVote[];
    reports: IReport[];
    replies: IReply[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IDiscussion extends Document {
    _id: Types.ObjectId;
    communityId?: Types.ObjectId;
    title: string;
    content: string;
    creator: Types.ObjectId;
    attachments: IAttachment[];
    replies: IReply[];
    votes: IVote[];
    status: 'open' | 'closed' | 'archived';
    reports: IReport[];
    createdAt: Date;
    updatedAt: Date;
    upvotesCount: number;
    downvotesCount: number;

    // Methods
    addReply(
        content: string,
        creator: Types.ObjectId,
        attachments: IAttachment[]
    ): Promise<any>;
    vote(userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<void>;
    report(userId: Types.ObjectId, reason: string): Promise<void>;
    getVoteCounts(): { upvotes: number; downvotes: number };
}

export interface IMember {
    userId: Types.ObjectId;
    roleIds: Types.ObjectId[];
    joinedAt: Date;
    admin: boolean;
}

export interface ICommunity extends Document {
    owner: Types.ObjectId;
    name: string;
    handle: string;
    description?: string;
    type: "Official" | "Community";
    icon?: string;
    banner?: string;
    members: IMember[];
    roles: Types.ObjectId[];
    discussions: Types.ObjectId[];
    resources: Types.ObjectId[];
    invite: {
        code?: string;
        expiresAt?: Date;
    };
    stats: {
        membersCount: number;
        discussionsCount: number;
        resourcesCount: number;
    };
    settings: {
        isPrivate: boolean;
        requiresApproval: boolean;
        allowDiscussions: boolean;
        allowResourceSharing: boolean;
    };
    createdAt: Date;
    updatedAt: Date;

    // Methods
    isMember(userId: Types.ObjectId): boolean;
    hasRole(userId: Types.ObjectId, roleId: Types.ObjectId): boolean;
    addMember(
        userId: Types.ObjectId,
        roleIds?: Types.ObjectId[]
    ): Promise<void>;
    removeMember(userId: Types.ObjectId): Promise<void>;
    generateInvite(): Promise<string>;
    getInviteLink(): string | null;
}

export interface IRole extends Document {
    communityId: Types.ObjectId;
    name: string;
    color?: number;
    permissions: number;
    mentionable: boolean;
    createdAt: Date;
}

export interface IResource extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    fileUrl: string;
    fileType: 'document' | 'image' | 'video' | 'audio' | 'other';
    mimeType: string;
    originalFileName: string;
    checksum: string;
    fileSize: number;
    tags: string[];
    visibility: "public" | "community" | "private";
    category: string;
    uploader: Types.ObjectId;
    community: Types.ObjectId;
    interactionStats: {
        downloads: number;
        views: number;
    };
    votes: {
        userId: Types.ObjectId;
        voteType: 'upvote' | 'downvote';
        createdAt: Date;
    }[];
    reports: {
        userId: Types.ObjectId;
        reason: string;
        createdAt: Date;
    }[];
    comments: {
        userId: Types.ObjectId;
        content: string;
        createdAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
    upvotesCount: number;
    downvotesCount: number;

    // Methods
    isAccessibleBy(
        userId: Types.ObjectId,
        userCommunities: Types.ObjectId[]
    ): boolean;
    incrementDownloads(): Promise<void>;
    incrementViews(): Promise<void>;
    vote(userId: Types.ObjectId, voteType: 'upvote' | 'downvote'): Promise<void>;
    report(userId: Types.ObjectId, reason: string): Promise<void>;
    addComment(userId: Types.ObjectId, content: string): Promise<void>;
}

export interface IEvent {
    title: string;
    description?: string;
    dateTime: Date;
    location?: string;
    capacity?: number;
    visibility: "public" | "private" | "community";
    attendees?: Types.ObjectId[];
    creatorId: Types.ObjectId;
    status: "upcoming" | "ongoing" | "completed" | "cancelled";
    recommendations?: Types.ObjectId[];
    communityId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IRSVP {
    eventId: Types.ObjectId;
    userId: Types.ObjectId;
    status: "attending" | "not_attending" | "interested";
    createdAt: Date;
    updatedAt: Date;
}

// Add this interface for the Conversation model
export interface IConversationModel extends Model<IConversation> {
    findOrCreateDM(
        participant1Id: Types.ObjectId,
        participant2Id: Types.ObjectId
    ): Promise<IConversation>;
    findActiveConversations(userId: Types.ObjectId): Promise<IConversation[]>;
    findAdminGroups(userId: Types.ObjectId): Promise<IConversation[]>;
}
