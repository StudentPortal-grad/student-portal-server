import { IRole } from '../models/Role';
import Role from '../models/Role';

export class RoleRepository {
  async create(role: Partial<IRole>): Promise<IRole> {
    return Role.create(role);
  }

  async findAll(): Promise<IRole[]> {
    return Role.find().exec();
  }

  async findById(id: string): Promise<IRole | null> {
    return Role.findById(id).exec();
  }
}