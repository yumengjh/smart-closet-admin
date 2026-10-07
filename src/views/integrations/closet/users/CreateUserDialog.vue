<script setup lang="ts">
import { createClosetUser, type ClosetRole } from "@/api/closet/users";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { message } from "@/utils/message";
import { reactive, ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [result: { username: string; temporaryPassword: string | null }];
  unavailable: [];
}>();
const formRef = ref();
const submitting = ref(false);
const form = reactive<{ username: string; role: ClosetRole; password: string }>(
  { username: "", role: "USER", password: "" }
);
const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    {
      pattern: /^[A-Za-z0-9_.-]{2,80}$/,
      message: "使用 2–80 位字母、数字、点、下划线或短横线",
      trigger: "blur"
    }
  ],
  password: [
    { min: 12, max: 200, message: "密码需为 12–200 个字符", trigger: "blur" }
  ]
};
watch(
  () => props.modelValue,
  open => {
    if (open) Object.assign(form, { username: "", role: "USER", password: "" });
  }
);
const submit = async () => {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  submitting.value = true;
  try {
    const { data } = await createClosetUser({
      username: form.username.trim(),
      role: form.role,
      password: form.password || null
    });
    emit("created", data);
    emit("update:modelValue", false);
    message("业务用户已创建", { type: "success" });
  } catch (error) {
    if (isClosetServiceUnavailable(error)) emit("unavailable");
    else message("创建用户失败，请检查用户名和输入内容", { type: "error" });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="创建业务用户"
    width="500px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="104px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" autocomplete="off" maxlength="80" />
      </el-form-item>
      <el-form-item label="角色" prop="role">
        <el-select v-model="form.role" class="w-full">
          <el-option label="普通用户" value="USER" />
          <el-option label="管理员" value="ADMIN" />
        </el-select>
      </el-form-item>
      <el-form-item label="初始密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="留空则生成一次性临时密码"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit"
        >创建用户</el-button
      >
    </template>
  </el-dialog>
</template>
