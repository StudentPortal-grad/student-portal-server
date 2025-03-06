import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  username: string;
  gender: 'male' | 'female';
  phoneNumber: string;
  dateOfBirth: Date;
  university: string;
  college: string;
  email: string;
  password: string;
  role: 'student' | 'faculty' | 'admin';
  signupStep: 'initial' | 'verified' | 'password_set' | 'completed';
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
  status: 'online' | 'offline' | 'idle' | 'dnd';
  isGraduated?: boolean;
  graduationYear?: number;
  tempEmail?: string;
  universityEmailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  generateAuthToken(): string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateResetToken(): Promise<string>;
  updateStatus(status: 'online' | 'offline' | 'idle' | 'dnd'): Promise<void>;
}

export interface IConversation extends Document {
  type: 'DM' | 'GroupDM';
  participants: Types.ObjectId[];
  name?: string;
  createdBy: Types.ObjectId;
  messages?: Types.ObjectId[];
  inviteLink?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussion extends Document {
  communityId: Types.ObjectId;
  title: string;
  content: string;
  creator: Types.ObjectId;
  attachments?: {
    type: string;
    resource: string;
  }[];
  replies?: {
    id: Types.ObjectId;
    content: string;
    creator: Types.ObjectId;
    createdAt: Date;
    attachments?: {
      type: string;
      resource: string;
    }[];
  }[];
  votes?: {
    userId: Types.ObjectId;
    voteType: 'upvote' | 'downvote';
    createdAt: Date;
  }[];
  status: 'open' | 'closed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  senderId: Types.ObjectId;
  content?: string;
  attachments?: {
    type: string;
    resource?: string;
    thread?: Types.ObjectId;
  }[];
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

export interface INotification extends Document {
  user_id: Types.ObjectId;
  type: string;
  content: string;
  status: 'read' | 'unread';
  timestamp: Date;
  metadata?: {
    event_id?: Types.ObjectId;
    [key: string]: any;
  };
}

export interface IMember {
  userId: Types.ObjectId;
  roleIds: Types.ObjectId[];
  joinedAt: Date;
}

export interface ICommunity extends Document {
  owner: Types.ObjectId;
  name: string;
  handle: string;
  description?: string;
  type: 'Official' | 'Community';
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
  addMember(userId: Types.ObjectId, roleIds?: Types.ObjectId[]): Promise<void>;
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

export interface IResource {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  fileUrl: string;
  fileSize: number;
  tags: string[];
  visibility: 'public' | 'community' | 'private';
  category: string;
  uploader: Types.ObjectId;
  community: Types.ObjectId;
  interactionStats: {
    downloads: number;
    rating: number;
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isAccessibleBy(userId: Types.ObjectId, userCommunities: Types.ObjectId[]): boolean;
  incrementDownloads(): Promise<void>;
  }
