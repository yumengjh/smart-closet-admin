import { http } from "@/utils/http";

export type ApiResponse<T> = {
  data: T;
  traceId: string;
  timestamp: number;
};

export type AccessTokenResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  avatarUrl: string;
  roles: Array<string>;
  permissions: Array<string>;
};

export type AvatarCandidate = {
  candidateId: string;
  previewUrl: string;
  expiresAt: string;
};

export type LoginPayload = {
  username: string;
  password: string;
  rememberMe: boolean;
};

export type RegisterPayload = {
  username: string;
  displayName: string;
  password: string;
};

export const loginApi = (data: LoginPayload) =>
  http.request<ApiResponse<AccessTokenResponse>>("post", "/auth/login", {
    data
  });

export const registerApi = (data: RegisterPayload) =>
  http.request<ApiResponse<CurrentUser>>("post", "/auth/register", { data });

export const refreshTokenApi = () =>
  http.request<ApiResponse<AccessTokenResponse>>("post", "/auth/refresh");

export const logoutApi = () => http.request<void>("post", "/auth/logout");

export const getCurrentUser = () =>
  http.request<ApiResponse<CurrentUser>>("get", "/users/me");

export type Session = {
  firstIssuedAt: number;
  lastActiveAt: number;
  expiresAt: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "ROTATED";
};
export const updateMyProfile = (displayName: string) =>
  http.request<ApiResponse<CurrentUser>>("patch", "/users/me", {
    data: { displayName }
  });
export const changeMyPassword = (
  currentPassword: string,
  newPassword: string
) =>
  http.request<void>("put", "/users/me/password", {
    data: { currentPassword, newPassword }
  });
export const listMySessions = () =>
  http.request<ApiResponse<Session[]>>("get", "/users/me/sessions");
export const revokeAllMySessions = () =>
  http.request<void>("post", "/users/me/sessions/revoke");
export const uploadMyAvatar = (file: File) => {
  const data = new FormData();
  data.append("file", file);
  return http.request<ApiResponse<CurrentUser>>("put", "/users/me/avatar", {
    data
  });
};
export const resetMyAvatar = () =>
  http.request<ApiResponse<CurrentUser>>("delete", "/users/me/avatar");
export const createAvatarCandidate = () =>
  http.request<ApiResponse<AvatarCandidate>>(
    "post",
    "/users/me/avatar/system-candidates"
  );
export const applyAvatarCandidate = (candidateId: string) =>
  http.request<ApiResponse<CurrentUser>>(
    "post",
    "/users/me/avatar/system-candidates/" + candidateId + "/apply"
  );
