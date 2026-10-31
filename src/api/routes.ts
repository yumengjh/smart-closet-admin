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
    | "resume-management"
    | "account-security"
    | "gc-management"
    | "sql-console"
    | "closet-registration"
    | "closet-account-events"
    | "closet-security-audit"
    | "closet-users"
    | "closet-insights"
    | "closet-dashboard"
    | "closet-ops"
    | "closet-exports"
    | "closet-templates"
    | "closet-style-terms"
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
