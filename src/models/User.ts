import { Schema, model, Types } from 'mongoose';
import { IUser } from './types';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface IFriend {
  userId: Types.ObjectId;
  messageId: Types.ObjectId;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      maxlength: 255,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      maxlength: 320,
    },
    password: {
      type: String,
      required: true,
      maxlength: 60,
    },
    role: {
      type: String,
      required: true,
      enum: ['Student', 'Faculty', 'Admin'],
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
    friends: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      },
    ],
    level: {
      type: Number,
      required: true,
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
    confirmEmail: {
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
        communityId: { type: Schema.Types.ObjectId, ref: 'Community' },
        role: String,
      },
    ],
    status: {
      type: String,
      required: true,
      enum: ['online', 'offline', 'idle', 'dnd'],
      default: 'offline',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ universityEmail: 1 }, { sparse: true, unique: true });

// Pre-save middleware for password hashing
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
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
      /* global process */
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
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
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.otp = {
      code: crypto.createHash('sha256').update(resetToken).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    await this.save();
    return resetToken;
  },

  // Update online status
  updateStatus: async function (
    status: 'online' | 'offline' | 'idle' | 'dnd'
  ): Promise<void> {
    this.status = status;
    await this.save();
  },

  // Add friend
  addFriend: async function (
    friendId: Types.ObjectId,
    messageId: Types.ObjectId
  ): Promise<void> {
    if (
      !this.friends?.some((friend: IFriend) => friend.userId.equals(friendId))
    ) {
      this.friends = [...(this.friends || []), { userId: friendId, messageId }];
      await this.save();
    }
  },

  // Remove friend
  removeFriend: async function (friendId: Types.ObjectId): Promise<void> {
    if (this.friends) {
      this.friends = this.friends.filter(
        (friend: IFriend) => !friend.userId.equals(friendId)
      );
      await this.save();
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
    return this.find({ status: 'online' }).select('name status');
  },
};

export default model<IUser>('User', UserSchema);
