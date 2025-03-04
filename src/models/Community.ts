import { Schema, model, Types } from 'mongoose';
import { ICommunity } from './types';

interface IMember {
  userId: Types.ObjectId;
  roleIds: Types.ObjectId[];
  joinedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 255,
      trim: true,
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
    inviteLink: {
      type: String,
      maxlength: 500,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Remove duplicate indexes and keep only the non-duplicate one
CommunitySchema.index({ 'members.userId': 1 });

// Methods
CommunitySchema.methods = {
  // Check if a user is a member
  isMember: function (userId: Types.ObjectId): boolean {
    return this.members.some((member: IMember) => member.userId.equals(userId));
  },

  // Check if a user has a specific role
  hasRole: function (userId: Types.ObjectId, roleId: Types.ObjectId): boolean {
    const member = this.members.find((m: IMember) => m.userId.equals(userId));
    return member
      ? member.roleIds.some((id: Types.ObjectId) => id.equals(roleId))
      : false;
  },

  // Add a member
  addMember: async function (
    userId: Types.ObjectId,
    roleIds: Types.ObjectId[] = []
  ) {
    if (!this.isMember(userId)) {
      this.members.push({
        userId,
        roleIds,
        joinedAt: new Date(),
      });
      await this.save();
    }
  },

  // Remove a member
  removeMember: async function (userId: Types.ObjectId) {
    this.members = this.members.filter(
      (member: IMember) => !member.userId.equals(userId)
    );
    await this.save();
  },

  // Generate new invite link
  generateInviteLink: async function () {
    const uniqueId = new Types.ObjectId().toString();
    this.inviteLink = `https://studentportal.com/join/${this.name.toLowerCase()}-${uniqueId}`;
    await this.save();
    return this.inviteLink;
  },
};

// Statics
CommunitySchema.statics = {
  // Find communities where user is a member
  findUserCommunities: function (userId: Types.ObjectId) {
    return this.find({
      'members.userId': userId,
    }).select('name type icon');
  },

  // Find by invite link
  findByInviteLink: function (inviteLink: string) {
    return this.findOne({ inviteLink });
  },
};

export default model<ICommunity>('Community', CommunitySchema);
