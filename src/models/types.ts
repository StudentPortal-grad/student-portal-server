import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'Student' | 'Faculty' | 'Admin';
  profile?: {
    bio?: string;
    interests?: string[];
  };
  addresses?: {
    street: string;
    city: string;
    country: string;
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
    academic_progress: number;
    event_stats: {
      attended: number;
    };
  };
  confirmEmail: boolean;
  otp?: {
    code: string;
    expiresAt: Date;
  };
  roles?: {
    communityId: Types.ObjectId;
    role: string;
  }[];
  status: 'online' | 'offline' | 'idle' | 'dnd';
  createdAt: Date;
  updatedAt: Date;
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

export interface ICommunity extends Document {
  owner: Types.ObjectId;
  name: string;
  description?: string;
  type: 'Official' | 'Community';
  icon?: string;
  members?: {
    userId: Types.ObjectId;
    roleIds: Types.ObjectId[];
    joinedAt: Date;
  }[];
  roles?: Types.ObjectId[];
  discussions?: Types.ObjectId[];
  inviteLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRole extends Document {
  communityId: Types.ObjectId;
  name: string;
  color?: number;
  permissions: number;
  mentionable: boolean;
  createdAt: Date;
} 