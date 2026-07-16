import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type MenuType = "DIRECTORY" | "PAGE";

export type NavigationMenu = {
  id: string;
  parentId: string | null;
  code: string;
  title: string;
  routePath: string;
  componentKey:
    | "welcome"
    | "permission-page"
    | "menu-management"
    | "user-management"
    | "rbac-management"
    | "runtime-config"
    | "ip-rule-management"
    | "audit-log"
    | "announcement-management"
    | "resume-management"
    | "account-security"
    | "gc-management"
    | "sql-console"
    | null;
  icon: string | null;
  sortOrder: number;
  menuType: MenuType;
  requiredPermission: string | null;
  visible: boolean;
  enabled: boolean;
  keepAlive: boolean;
  systemManaged: boolean;
  children: NavigationMenu[];
};

export type NavigationMenuPayload = Omit<
  NavigationMenu,
  "id" | "systemManaged" | "children"
>;

export const listMenus = () =>
  http.request<ApiResponse<NavigationMenu[]>>("get", "/navigation/menus");

export const createMenu = (data: NavigationMenuPayload) =>
  http.request<ApiResponse<NavigationMenu>>("post", "/navigation/menus", {
    data
  });

export const updateMenu = (id: string, data: NavigationMenuPayload) =>
  http.request<ApiResponse<NavigationMenu>>("put", `/navigation/menus/${id}`, {
    data
  });

export const setMenuEnabled = (id: string, enabled: boolean) =>
  http.request<ApiResponse<NavigationMenu>>(
    "patch",
    `/navigation/menus/${id}/enabled`,
    { data: { enabled } }
  );

export const deleteMenu = (id: string) =>
  http.request<void>("delete", `/navigation/menus/${id}`);
