import { RoleRepository } from '../repositories/role.repo';
import { IRole } from '../models/types';
import { AppError, ErrorCodes } from '../utils/appError';

export class RoleService {
  private roleRepository: RoleRepository;

  constructor() {
    this.roleRepository = new RoleRepository();
  }

  async createRole(role: Partial<IRole>): Promise<IRole> {
    return this.roleRepository.create(role);
  }

  async getAllRoles(): Promise<IRole[]> {
    return this.roleRepository.findAll();
  }

  async getRoleById(id: string): Promise<IRole> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new AppError('Role not found', 404, ErrorCodes.NOT_FOUND);
    }
    return role;
  }

  async getCommunityRoles(communityId: string): Promise<IRole[]> {
    return this.roleRepository.findByCommunity(communityId);
  }

  async updateRole(id: string, roleData: Partial<IRole>): Promise<IRole> {
    const updatedRole = await this.roleRepository.update(id, roleData);
    if (!updatedRole) {
      throw new AppError('Role not found', 404, ErrorCodes.NOT_FOUND);
    }
    return updatedRole;
  }

  async deleteRole(id: string): Promise<IRole> {
    const deletedRole = await this.roleRepository.delete(id);
    if (!deletedRole) {
      throw new AppError('Role not found', 404, ErrorCodes.NOT_FOUND);
    }
    return deletedRole;
  }

  async addPermission(id: string, permission: number): Promise<IRole> {
    const role = await this.roleRepository.addPermission(id, permission);
    if (!role) {
      throw new AppError('Role not found', 404, ErrorCodes.NOT_FOUND);
    }
    return role;
  }

  async removePermission(id: string, permission: number): Promise<IRole> {
    const role = await this.roleRepository.removePermission(id, permission);
    if (!role) {
      throw new AppError('Role not found', 404, ErrorCodes.NOT_FOUND);
    }
    return role;
  }

  async assignRoleToMember(communityId: string, userId: string, roleId: string): Promise<boolean> {
    // First check if role exists and belongs to the community
    const role = await this.roleRepository.findById(roleId);
    if (!role || role.communityId.toString() !== communityId) {
      throw new AppError('Role not found in this community', 404, ErrorCodes.NOT_FOUND);
    }
    
    return this.roleRepository.assignRoleToMember(communityId, userId, roleId);
  }

  async removeRoleFromMember(communityId: string, userId: string, roleId: string): Promise<boolean> {
    // First check if role exists and belongs to the community
    const role = await this.roleRepository.findById(roleId);
    if (!role || role.communityId.toString() !== communityId) {
      throw new AppError('Role not found in this community', 404, ErrorCodes.NOT_FOUND);
    }
    
    return this.roleRepository.removeRoleFromMember(communityId, userId, roleId);
  }

  async getMemberRoles(communityId: string, userId: string): Promise<IRole[]> {
    return this.roleRepository.getMemberRoles(communityId, userId);
  }

  async hasPermission(userId: string, communityId: string, permission: number): Promise<boolean> {
    const roles = await this.roleRepository.getMemberRoles(communityId, userId);
    return roles.some(role => (role.permissions & permission) === permission);
  }
}