import { isIncludeAllChildren, isString, storageLocal } from "@pureadmin/utils";
import { useUserStoreHook } from "@/store/modules/user";

export interface TokenInfo {
  accessToken: string;
  expires: number;
}

export interface UserInfo {
  avatar?: string;
  username?: string;
  nickname?: string;
  roles?: Array<string>;
  permissions?: Array<string>;
}

export interface AccessTokenPayload {
  accessToken: string;
  expiresIn: number;
}

export const userKey = "user-info";

let token: TokenInfo | undefined;

/** Access Token only lives in memory. The Refresh Token is an HttpOnly server cookie. */
export function getToken(): TokenInfo | undefined {
  return token;
}

export function setToken(data: AccessTokenPayload) {
  token = {
    accessToken: data.accessToken,
    expires: Date.now() + data.expiresIn * 1000
  };
}

export function setUserInfo(data: UserInfo) {
  storageLocal().setItem(userKey, data);
}

export function removeToken() {
  token = undefined;
  storageLocal().removeItem(userKey);
}

export const formatToken = (value: string): string => `Bearer ${value}`;

export const hasPerms = (value: string | Array<string>): boolean => {
  if (!value) return false;
  const permissions = useUserStoreHook().permissions;
  if (!permissions?.length) return false;
  if (permissions.length === 1 && permissions[0] === "*:*") return true;
  return isString(value)
    ? permissions.includes(value)
    : isIncludeAllChildren(value, permissions);
};
