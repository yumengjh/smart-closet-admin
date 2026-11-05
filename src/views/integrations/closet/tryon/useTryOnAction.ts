import { onBeforeUnmount, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { message } from "@/utils/message";

export function useTryOnAction() {
  const { can } = useCurrentPermissions();
  let disposed = false;
  onBeforeUnmount(() => {
    disposed = true;
  });
  const saving = ref(false);
  const actionError = ref("");
  const act = async <T>(
    permission: string,
    title: string,
    description: string,
    operation: () => Promise<T>
  ) => {
    if (disposed || !can(`closet:tryon:${permission}`) || saving.value) return;
    saving.value = true;
    actionError.value = "";
    try {
      await ElMessageBox.confirm(description, title, {
        type: permission === "stop" ? "error" : "warning",
        confirmButtonText: title,
        cancelButtonText: "取消"
      });
      if (disposed || !can(`closet:tryon:${permission}`)) return;
      const result = await operation();
      message(`${title}成功`, { type: "success" });
      return result;
    } catch (error) {
      if (error === "cancel" || error === "close") return;
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      actionError.value = isClosetServiceUnavailable(error)
        ? "鱼搭服务暂不可用，请稍后重试。"
        : status === 409
          ? "操作发生冲突，请重新读取最新状态后再操作。设置版本可能已变化，凭证也可能仍被会话使用。"
          : status === 403
            ? "当前账号没有此操作权限。"
            : "操作失败，请检查输入与接入状态后重试。";
      // Never display raw provider errors or credential request bodies.
      message(actionError.value, { type: "error" });
    } finally {
      saving.value = false;
    }
  };
  return { can, saving, actionError, act };
}
