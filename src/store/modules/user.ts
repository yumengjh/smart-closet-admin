import { defineStore } from "pinia";
import {
  storageLocal,
  store,
  router,
  resetRouter,
  routerArrays,
  type userType
} from "../utils";
import {
  getCurrentUser,
  loginApi,
  logoutApi,
  refreshTokenApi,
  type LoginPayload
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import {
  removeToken,
  setToken,
  setUserInfo,
  userKey,
  type UserInfo
} from "@/utils/auth";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => {
    const user = storageLocal().getItem<UserInfo>(userKey);
    return {
      avatar: user?.avatar ?? "",
      username: user?.username ?? "",
      nickname: user?.nickname ?? "",
      roles: user?.roles ?? [],
      permissions: user?.permissions ?? [],
      isRemembered: false,
      loginDay: 30
    };
  },
  actions: {
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    SET_USERNAME(username: string) {
      this.username = username;
    },
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    SET_ISREMEMBERED(value: boolean) {
      this.isRemembered = value;
    },
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    async loginByUsername(data: LoginPayload) {
      const response = await loginApi(data);
      setToken(response.data);
      this.SET_ISREMEMBERED(data.rememberMe);
      await this.loadProfile();
    },
    async handRefreshToken() {
      const response = await refreshTokenApi();
      setToken(response.data);
      return response.data;
    },
    async restoreSession() {
      try {
        await this.handRefreshToken();
        await this.loadProfile();
        return true;
      } catch {
        this.clearSession();
        return false;
      }
    },
    async loadProfile() {
      const response = await getCurrentUser();
      const user = response.data;
      this.SET_USERNAME(user.username);
      this.SET_NICKNAME(user.displayName);
      this.SET_ROLES(user.roles);
      this.SET_PERMS(user.permissions);
      setUserInfo({
        avatar: this.avatar,
        username: user.username,
        nickname: user.displayName,
        roles: user.roles,
        permissions: user.permissions
      });
    },
    clearSession() {
      this.username = "";
      this.nickname = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
    },
    async logOut() {
      try {
        await logoutApi();
      } finally {
        this.clearSession();
        router.push("/login");
      }
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
