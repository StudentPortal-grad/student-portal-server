import { RoleRepository } from '../repositories/role.repo';
import { IRole } from '../models/Role';

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
}