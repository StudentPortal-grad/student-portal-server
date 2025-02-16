import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  communityId: mongoose.Schema.Types.ObjectId; // Reference to the community
  name: string; // Name of the role, e.g., 'Admin', 'Moderator'
  color: number; // Color code for the role
  permissions: number; // Bitwise integer representing permissions
  mentionable: boolean; 
  createdAt: Date;
}

const RoleSchema: Schema = new Schema(
  {
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    name: { type: String, required: true },
    color: { type: Number, required: true },
    permissions: { type: Number, required: true },
    mentionable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IRole>('Role', RoleSchema);