import { RolePermissions } from '../models/Role';

export type CommunityPermission =
  | 'VIEW_COMMUNITY'
  | 'SEND_MESSAGES'
  | 'MANAGE_MESSAGES'
  | 'MANAGE_MEMBERS'
  | 'MANAGE_ROLES'
  | 'MANAGE_COMMUNITY';

export type PermissionValue =
  (typeof RolePermissions)[keyof typeof RolePermissions];
