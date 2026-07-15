import { computed } from "vue";
import { useUserStoreHook } from "@/store/modules/user";
import { hasPermission } from "./permissions.mjs";

export { hasPermission };

export function useCurrentPermissions() {
  const permissions = computed(() => useUserStoreHook().permissions);
  return {
    can: (permission: string) => hasPermission(permissions.value, permission)
  };
}
