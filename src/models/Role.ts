import mongoose, { Schema } from 'mongoose';
import { IRole } from './types';

const RoleSchema: Schema = new Schema<IRole>(
  {
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    color: {
      type: Number,
      min: 0,
      max: 16777215, // Maximum RGB value (0xFFFFFF)
      validate: {
        validator: function (v: number) {
          return Number.isInteger(v);
        },
        message: 'Color must be an integer RGB value',
      },
    },
    permissions: {
      type: Number,
      required: true,
      validate: {
        validator: function (v: number) {
          return Number.isInteger(v) && v >= 0;
        },
        message: 'Permissions must be a non-negative integer',
      },
    },
    mentionable: { type: Boolean, default: false },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique role names within a community
RoleSchema.index({ communityId: 1, name: 1 }, { unique: true });

// Constants for permission bits
export const RolePermissions = {
  VIEW_COMMUNITY: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  MANAGE_MEMBERS: 1 << 3,
  MANAGE_ROLES: 1 << 4,
  MANAGE_COMMUNITY: 1 << 5,
} as const;

// Methods
RoleSchema.methods = {
  // Check if role has specific permission
  hasPermission: function (permission: number): boolean {
    return (this.permissions & permission) === permission;
  },

  // Add permission
  addPermission: async function (permission: number) {
    this.permissions |= permission;
    await this.save();
  },

  // Remove permission
  removePermission: async function (permission: number) {
    this.permissions &= ~permission;
    await this.save();
  },
};

// Statics
RoleSchema.statics = {
  // Find all roles for a community
  findCommunityRoles: function (communityId: Schema.Types.ObjectId) {
    return this.find({ communityId }).sort('name');
  },
};

export default mongoose.model<IRole>('Role', RoleSchema);
