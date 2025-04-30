import { IRole } from '../models/types';
import Role from '../models/Role';
import { Types } from 'mongoose';

export class RoleRepository {
  async create(role: Partial<IRole>): Promise<IRole> {
    return Role.create(role);
  }

  async findAll(): Promise<IRole[]> {
    return Role.find().sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<IRole | null> {
    return Role.findById(id).exec();
  }

  async findByCommunity(communityId: string): Promise<IRole[]> {
    return Role.find({ communityId }).sort({ name: 1 }).exec();
  }

  async update(id: string, roleData: Partial<IRole>): Promise<IRole | null> {
    return Role.findByIdAndUpdate(
      id,
      { $set: roleData },
      { new: true, runValidators: true }
    ).exec();
  }

  async delete(id: string): Promise<IRole | null> {
    return Role.findByIdAndDelete(id).exec();
  }

  async addPermission(id: string, permission: number): Promise<IRole | null> {
    const role = await Role.findById(id);
    if (!role) return null;
    
    // Update the permissions directly
    role.permissions |= permission;
    await role.save();
    return role;
  }

  async removePermission(id: string, permission: number): Promise<IRole | null> {
    const role = await Role.findById(id);
    if (!role) return null;
    
    // Update the permissions directly
    role.permissions &= ~permission;
    await role.save();
    return role;
  }

  async findDefaultRoles(): Promise<IRole[]> {
    return Role.find({ isDefault: true }).exec();
  }

  async assignRoleToMember(communityId: string, userId: string, roleId: string): Promise<boolean> {
    const result = await Role.updateOne(
      { _id: roleId, communityId },
      { $addToSet: { members: userId } }
    );
    return result.modifiedCount > 0;
  }

  async removeRoleFromMember(communityId: string, userId: string, roleId: string): Promise<boolean> {
    const result = await Role.updateOne(
      { _id: roleId, communityId },
      { $pull: { members: userId } }
    );
    return result.modifiedCount > 0;
  }

  async getMemberRoles(communityId: string, userId: string): Promise<IRole[]> {
    return Role.find({
      communityId,
      members: { $in: [userId] }
    }).exec();
  }
}
