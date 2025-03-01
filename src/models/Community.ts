import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunity extends Document {
  owner: mongoose.Schema.Types.ObjectId; 
  name: string;
  description: string;
  type: string; // Enum: 'Official', 'Community'
  icon?: string; 
  members: Array<{
    userId: mongoose.Schema.Types.ObjectId;
    roleIds: mongoose.Schema.Types.ObjectId[]; 
  }>;
  roles: mongoose.Schema.Types.ObjectId[]; 
  discussions: mongoose.Schema.Types.ObjectId[]; 
  inviteLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema: Schema = new Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['Official', 'Community'], required: true },
    icon: { type: String, optional: true },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        roleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
      },
    ],
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    discussions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Discussion' }],
    inviteLink: { type: String, optional: true },
  },
  { timestamps: true }
);


export default mongoose.model<ICommunity>('Community', CommunitySchema);