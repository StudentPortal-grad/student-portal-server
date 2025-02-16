import { Request, Response } from 'express';
import { RoleService } from '../services/role.service';

const roleService = new RoleService();

export const createRole = async (req: Request, res: Response) => {
  const role = await roleService.createRole(req.body);
  res.status(201).json(role);
};

export const getAllRoles = async (req: Request, res: Response) => {
  const roles = await roleService.getAllRoles();
  res.status(200).json(roles);
};