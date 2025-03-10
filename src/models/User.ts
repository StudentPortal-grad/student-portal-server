import { Schema, model, Types } from 'mongoose';
import { IUser } from './types';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/* global process */
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
    username: {
      type: String,
      required: false,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    gender: {
      type: String,
      required: false,
      enum: ['male', 'female'],
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
        return this.signupStep === 'completed';
      },
    },
    college: {
      type: String,
      required: function (this: IUser) {
        return this.signupStep === 'completed';
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
      required: true,
      maxlength: 60,
      minlength: 8,
      select: false,
    },
    signupStep: {
      type: String,
      required: true,
      enum: ['initial', 'verified', 'completed'],
      default: 'initial',
    },
    role: {
      type: String,
      required: function (this: IUser) {
        return this.signupStep === 'completed';
      },
      enum: ['student', 'faculty', 'admin'],
    },
    profilePicture: {
      type: String,
      default: 'https://via.placeholder.com/150',
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
        userId: { type: Schema.Types.ObjectId, ref: 'Users' },
        messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
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
        message: 'Graduation year must be between 1900 and current year',
      },
    },
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
    collation: { locale: 'en', strength: 2 }, // Case-insensitive unique index
  }
);

// Pre-save middleware for password validation and hashing
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    // Validate password before hashing
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(this.password)) {
      throw new Error(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)'
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
      process.env.JWT_SECRET || 'sfjsd65gfsdf-sdgsdgsdg-dsgsdgsdg',
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
    await this.save({ validateBeforeSave: false });
    return resetToken;
  },

  // Update online status
  updateStatus: async function (
    status: 'online' | 'offline' | 'idle' | 'dnd'
  ): Promise<void> {
    this.status = status;
    await this.save({ validateBeforeSave: false });
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
      await this.save({ validateBeforeSave: false });
    }
  },

  // Remove friend
  removeFriend: async function (friendId: Types.ObjectId): Promise<void> {
    if (this.friends) {
      this.friends = this.friends.filter(
        (friend: IFriend) => !friend.userId.equals(friendId)
      );
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
    return this.find({ status: 'online' }).select('name status');
  },
};

export default model<IUser>('Users', UserSchema);
