import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type NavigationRoute = {
  code: string;
  path: string;
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
    | "account-security"
    | null;
  title: string;
  icon: string | null;
  rank: number;
  keepAlive: boolean;
  requiredPermission: string | null;
  children: NavigationRoute[];
};

export const getAsyncRoutes = () =>
  http.request<ApiResponse<NavigationRoute[]>>("get", "/navigation/routes");
