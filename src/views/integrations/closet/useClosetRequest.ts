import { onBeforeUnmount, ref } from "vue";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { message } from "@/utils/message";

export const formatTime = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : "—";
export const percent = (value?: number | null) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
export const bytes = (value?: number | null) =>
  value == null ? "—" : `${(value / 1024 / 1024).toFixed(1)} MB`;
export const dateRange = (): [string, string] => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const date = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [date(start), date(end)];
};
export function useClosetRequest() {
  const loading = ref(false);
  const unavailable = ref(false);
  const errorMessage = ref("");
  let serial = 0;
  onBeforeUnmount(() => {
    serial++;
  });
  const run = async <T>(
    operation: () => Promise<T>,
    apply: (result: T) => void
  ) => {
    const current = ++serial;
    loading.value = true;
    unavailable.value = false;
    errorMessage.value = "";
    try {
      const result = await operation();
      if (current === serial) {
        apply(result);
        return true;
      }
    } catch (error) {
      if (current !== serial) return false;
      if (isClosetServiceUnavailable(error)) unavailable.value = true;
      else {
        errorMessage.value =
          "读取失败，请检查筛选条件、日期范围与接入配置后重试";
        message(errorMessage.value, { type: "error" });
      }
    } finally {
      if (current === serial) loading.value = false;
    }
    return false;
  };
  return { loading, unavailable, errorMessage, run };
}
