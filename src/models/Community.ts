import { Schema, model, Types } from 'mongoose';
import { ICommunity } from './types';
import crypto from 'crypto';

/* global process */

interface IMember {
  userId: Types.ObjectId;
  roleIds: Types.ObjectId[];
  joinedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 255,
      trim: true,
    },
    handle: {
      type: String,
      required: true,
      unique: true,
      maxlength: 100,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    type: {
      type: String,
      required: true,
      enum: ['Official', 'Community'],
      default: 'Community',
    },
    icon: {
      type: String,
      maxlength: 2000,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Icon must be a valid URL',
      },
    },
    banner: {
      type: String,
      maxlength: 2000,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Banner must be a valid URL',
      },
    },
    members: [
      {
        _id: false,
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        roleIds: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Role',
          },
        ],
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    discussions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Discussion',
      },
    ],
    resources: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Resource',
      },
    ],
    invite: {
      code: {
        type: String,
        sparse: true,
        unique: true,
      },
      expiresAt: {
        type: Date,
      },
    },
    stats: {
      membersCount: {
        type: Number,
        default: 0,
      },
      discussionsCount: {
        type: Number,
        default: 0,
      },
      resourcesCount: {
        type: Number,
        default: 0,
      },
    },
    settings: {
      isPrivate: {
        type: Boolean,
        default: false,
      },
      requiresApproval: {
        type: Boolean,
        default: false,
      },
      allowDiscussions: {
        type: Boolean,
        default: true,
      },
      allowResourceSharing: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CommunitySchema.index({ 'members.userId': 1 });

// Methods
CommunitySchema.methods = {
  isMember(userId: Types.ObjectId): boolean {
    return this.members.some((member: IMember) => member.userId.equals(userId));
  },

  hasRole(userId: Types.ObjectId, roleId: Types.ObjectId): boolean {
    const member = this.members.find((m: IMember) => m.userId.equals(userId));
    return member
      ? member.roleIds.some((id: Types.ObjectId) => id.equals(roleId))
      : false;
  },

  async addMember(
    userId: Types.ObjectId,
    roleIds: Types.ObjectId[] = []
  ): Promise<void> {
    if (!this.isMember(userId)) {
      this.members.push({
        userId,
        roleIds,
        joinedAt: new Date(),
      });
      this.stats.membersCount = this.members.length;
      await this.save();
    }
  },

  async removeMember(userId: Types.ObjectId): Promise<void> {
    this.members = this.members.filter(
      (member: IMember) => !member.userId.equals(userId)
    );
    this.stats.membersCount = this.members.length;
    await this.save();
  },

  async generateInvite(): Promise<string> {
    const code = crypto.randomBytes(6).toString('hex');
    this.invite = {
      code,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
    await this.save();
    return code;
  },

  getInviteLink(): string | null {
    if (
      !this.invite.code ||
      !this.invite.expiresAt ||
      this.invite.expiresAt < new Date()
    ) {
      return null;
    }
    return `${process.env.CLIENT_URL}/communities/join/${this.invite.code}`;
  },

  async updateStats(): Promise<void> {
    this.stats = {
      membersCount: this.members.length,
      discussionsCount: this.discussions.length,
      resourcesCount: this.resources.length,
    };
    await this.save();
  },

  async updateSettings(
    settings: Partial<ICommunity['settings']>
  ): Promise<void> {
    Object.assign(this.settings, settings);
    await this.save();
  },

  async addDiscussion(discussionId: Types.ObjectId): Promise<void> {
    if (!this.discussions.includes(discussionId)) {
      this.discussions.push(discussionId);
      this.stats.discussionsCount = this.discussions.length;
      await this.save();
    }
  },

  async removeDiscussion(discussionId: Types.ObjectId): Promise<void> {
    this.discussions = this.discussions.filter(
      (id: Types.ObjectId) => !id.equals(discussionId)
    );
    this.stats.discussionsCount = this.discussions.length;
    await this.save();
  },

  async addResource(resourceId: Types.ObjectId): Promise<void> {
    if (!this.resources.includes(resourceId)) {
      this.resources.push(resourceId);
      this.stats.resourcesCount = this.resources.length;
      await this.save();
    }
  },

  async removeResource(resourceId: Types.ObjectId): Promise<void> {
    this.resources = this.resources.filter(
      (id: Types.ObjectId) => !id.equals(resourceId)
    );
    this.stats.resourcesCount = this.resources.length;
    await this.save();
  },

  async addRole(roleId: Types.ObjectId): Promise<void> {
    if (!this.roles.includes(roleId)) {
      this.roles.push(roleId);
      await this.save();
    }
  },

  async removeRole(roleId: Types.ObjectId): Promise<void> {
    this.roles = this.roles.filter((id: Types.ObjectId) => !id.equals(roleId));
    this.members.forEach((member: IMember) => {
      member.roleIds = member.roleIds.filter(
        (id: Types.ObjectId) => !id.equals(roleId)
      );
    });
    await this.save();
  },

  async assignRole(
    userId: Types.ObjectId,
    roleId: Types.ObjectId
  ): Promise<void> {
    const member: IMember | undefined = this.members.find((m: IMember) =>
      m.userId.equals(userId)
    );
    if (member && !member.roleIds.includes(roleId)) {
      member.roleIds.push(roleId);
      await this.save();
    }
  },

  async removeRoleFromMember(
    userId: Types.ObjectId,
    roleId: Types.ObjectId
  ): Promise<void> {
    const member: IMember | undefined = this.members.find((m: IMember) =>
      m.userId.equals(userId)
    );
    if (member) {
      member.roleIds = member.roleIds.filter(
        (id: Types.ObjectId) => !id.equals(roleId)
      );
      await this.save();
    }
  },
};

// Statics
CommunitySchema.statics = {
  findUserCommunities: function (userId: Types.ObjectId) {
    return this.find({
      'members.userId': userId,
    }).select('name type icon stats settings');
  },

  async findByInviteCode(code: string) {
    return this.findOne({
      'invite.code': code,
      'invite.expiresAt': { $gt: new Date() },
    });
  },

  async findPopular(limit: number = 10) {
    return this.find()
      .sort({ 'stats.membersCount': -1 })
      .limit(limit)
      .select('name handle icon stats');
  },

  async findByType(type: 'Official' | 'Community') {
    return this.find({ type });
  },

  async findByHandle(handle: string) {
    return this.findOne({ handle: handle.toLowerCase() });
  },

  async search(query: string) {
    return this.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { handle: { $regex: query, $options: 'i' } },
      ],
    }).select('name handle icon description stats');
  },

  async findMemberCommunities(userId: Types.ObjectId) {
    return this.find({
      'members.userId': userId,
    }).select('name handle icon type stats settings');
  },

  async findOwnedCommunities(userId: Types.ObjectId) {
    return this.find({
      owner: userId,
    }).select('name handle icon type stats settings');
  },

  async findWithRole(roleId: Types.ObjectId) {
    return this.find({
      roles: roleId,
    }).select('name handle');
  },
};

// Middleware
CommunitySchema.pre('save', function (next) {
  if (this.isNew) {
    const ownerMember = {
      userId: this.owner,
      roleIds: [],
      joinedAt: new Date(),
    };
    this.members = [ownerMember];
  }
  next();
});

CommunitySchema.pre('save', async function (next) {
  if (this.isModified('members')) {
    this.stats.membersCount = this.members.length;
  }
  if (this.isModified('discussions')) {
    this.stats.discussionsCount = this.discussions.length;
  }
  if (this.isModified('resources')) {
    this.stats.resourcesCount = this.resources.length;
  }
  next();
});

export default model<ICommunity>('Community', CommunitySchema);
