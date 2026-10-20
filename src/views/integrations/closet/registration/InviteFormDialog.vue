<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { FormInstance } from "element-plus";
import {
  createClosetInvite,
  updateClosetInvite,
  type Invite
} from "@/api/closet/registration";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
const props = defineProps<{ modelValue: boolean; invite?: Invite }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [code: string];
  saved: [];
  unavailable: [];
}>();
const { can } = useCurrentPermissions();
const formRef = ref<FormInstance>();
const saving = ref(false);
const form = reactive({
  note: "",
  maxUses: 1,
  expiresInDays: 7,
  expiresAtMs: undefined as number | undefined
});
const rules = {
  maxUses: [
    {
      required: true,
      type: "number" as const,
      min: 1,
      max: 100,
      message: "名额需为 1–100",
      trigger: "change"
    }
  ],
  expiresInDays: [
    {
      required: true,
      type: "number" as const,
      min: 1,
      max: 90,
      message: "有效天数需为 1–90",
      trigger: "change"
    }
  ],
  expiresAtMs: [
    { required: true, message: "请选择到期时间", trigger: "change" }
  ]
};
watch(
  () => props.modelValue,
  open => {
    if (!open) return;
    Object.assign(form, {
      note: props.invite?.note ?? "",
      maxUses: props.invite?.maxUses ?? 1,
      expiresInDays: 7,
      expiresAtMs: props.invite?.expiresAtMs
    });
    formRef.value?.clearValidate();
  }
);
const save = async () => {
  if (
    !can("closet:registration:write") ||
    saving.value ||
    !(await formRef.value?.validate().catch(() => false))
  )
    return;
  saving.value = true;
  try {
    if (props.invite) {
      await updateClosetInvite(props.invite.id, {
        note: form.note.trim(),
        maxUses: form.maxUses,
        expiresAtMs: Number(form.expiresAtMs)
      });
      emit("saved");
      message("邀请码已更新", { type: "success" });
    } else {
      const { data } = await createClosetInvite({
        note: form.note.trim(),
        maxUses: form.maxUses,
        expiresInDays: form.expiresInDays
      });
      emit("created", data.code);
    }
    emit("update:modelValue", false);
  } catch (error) {
    if (isClosetServiceUnavailable(error)) {
      emit("unavailable");
      emit("update:modelValue", false);
    } else
      message("保存失败，请检查名额和到期时间；已撤销的邀请码不能修改", {
        type: "error"
      });
  } finally {
    saving.value = false;
  }
};
</script>
<template>
  <el-dialog
    :model-value="modelValue"
    :title="invite ? '编辑邀请码' : '创建邀请码'"
    width="min(520px, 94vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="!saving && emit('update:modelValue', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="96px"
      @submit.prevent="save"
    >
      <el-form-item label="备注"
        ><el-input v-model="form.note" maxlength="100" show-word-limit
      /></el-form-item>
      <el-form-item label="注册名额" prop="maxUses"
        ><el-input-number
          v-model="form.maxUses"
          :min="Math.max(1, invite?.usedCount ?? 0)"
          :max="100"
          :precision="0"
      /></el-form-item>
      <el-form-item v-if="!invite" label="有效天数" prop="expiresInDays"
        ><el-input-number
          v-model="form.expiresInDays"
          :min="1"
          :max="90"
          :precision="0"
      /></el-form-item>
      <el-form-item v-else label="到期时间" prop="expiresAtMs"
        ><el-date-picker
          v-model="form.expiresAtMs"
          type="datetime"
          value-format="x"
          class="!w-full"
          :clearable="false"
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="emit('update:modelValue', false)"
        >取消</el-button
      ><el-button type="primary" :loading="saving" @click="save">{{
        invite ? "保存修改" : "创建邀请码"
      }}</el-button></template
    >
  </el-dialog>
</template>
