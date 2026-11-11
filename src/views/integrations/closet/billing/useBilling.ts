import { onBeforeUnmount, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";

export function useBilling() {
  const { can } = useCurrentPermissions();
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  let disposed = false;
  let serial = 0;
  onBeforeUnmount(() => {
    disposed = true;
    serial++;
  });
  const fail = (cause: unknown) => {
    const body = (cause as { response?: { data?: { message?: string } } })
      ?.response?.data;
    error.value = body?.message || "请求失败，请稍后重试";
    message(error.value, { type: "error" });
  };
  const load = async <T>(
    operation: () => Promise<T>,
    apply: (value: T) => void
  ) => {
    const current = ++serial;
    loading.value = true;
    error.value = "";
    try {
      const result = await operation();
      if (!disposed && current === serial) apply(result);
    } catch (cause) {
      if (!disposed && current === serial) fail(cause);
    } finally {
      if (current === serial) loading.value = false;
    }
  };
  const write = async <T>(
    title: string,
    operation: () => Promise<T>,
    apply: (value: T) => void,
    confirmation?: string
  ) => {
    if (disposed || saving.value || !can("closet:billing:write")) return;
    saving.value = true;
    error.value = "";
    try {
      if (confirmation)
        await ElMessageBox.confirm(confirmation, title, {
          type: "warning",
          confirmButtonText: "确认",
          cancelButtonText: "取消"
        });
      if (disposed || !can("closet:billing:write")) return;
      const result = await operation();
      if (!disposed) {
        apply(result);
        message(`${title}成功`, { type: "success" });
      }
    } catch (cause) {
      if (!disposed && cause !== "cancel" && cause !== "close") fail(cause);
    } finally {
      saving.value = false;
    }
  };
  return { can, loading, saving, error, load, write };
}
export const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
export const money = (value: number | null | undefined, scale = 100) =>
  value == null
    ? "—"
    : scale === 100
      ? (value / scale).toFixed(2)
      : `${value / scale}`;
