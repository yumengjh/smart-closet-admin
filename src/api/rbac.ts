import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type Role = { code: string; displayName: string; permissions: string[] };
export type Permission = { code: string; description: string | null };
export type RolePayload = { code: string; displayName: string };
export type PermissionPayload = { code: string; description?: string | null };
export const rolePayload = (
  code: string,
  displayName: string
): RolePayload => ({ code, displayName });
export const listRoles = () =>
  http.request<ApiResponse<Role[]>>("get", "/rbac/roles");
export const listPermissions = () =>
  http.request<ApiResponse<Permission[]>>("get", "/rbac/permissions");
export const createRole = (data: RolePayload) =>
  http.request<ApiResponse<Role>>("post", "/rbac/roles", { data });
export const updateRole = (code: string, data: RolePayload) =>
  http.request<ApiResponse<Role>>("put", `/rbac/roles/${code}`, { data });
export const deleteRole = (code: string) =>
  http.request<void>("delete", `/rbac/roles/${code}`);
export const createPermission = (data: PermissionPayload) =>
  http.request<ApiResponse<Permission>>("post", "/rbac/permissions", { data });
export const updatePermission = (code: string, data: PermissionPayload) =>
  http.request<ApiResponse<Permission>>("put", `/rbac/permissions/${code}`, {
    data
  });
export const deletePermission = (code: string) =>
  http.request<void>("delete", `/rbac/permissions/${code}`);
export const assignUserRole = (userId: string, roleCode: string) =>
  http.request<void>("put", `/rbac/users/${userId}/roles/${roleCode}`);
export const removeUserRole = (userId: string, roleCode: string) =>
  http.request<void>("delete", `/rbac/users/${userId}/roles/${roleCode}`);
export const grantRolePermission = (roleCode: string, permissionCode: string) =>
  http.request<void>(
    "put",
    `/rbac/roles/${roleCode}/permissions/${permissionCode}`
  );
export const revokeRolePermission = (
  roleCode: string,
  permissionCode: string
) =>
  http.request<void>(
    "delete",
    `/rbac/roles/${roleCode}/permissions/${permissionCode}`
  );
