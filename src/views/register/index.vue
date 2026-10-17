<script setup lang="ts">
import Motion from "@/views/login/utils/motion";
import { computed, reactive, ref, toRaw } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import { registerApi } from "@/api/user";
import { message } from "@/utils/message";
import { useNav } from "@/layout/hooks/useNav";
import {
  bg,
  logo,
  illustrationLight,
  illustrationDark
} from "@/views/login/utils/static";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import User from "~icons/ri/user-3-fill";
import Lock from "~icons/ri/lock-fill";

defineOptions({ name: "Register" });

const router = useRouter();
const { title } = useNav();
const loading = ref(false);
const formRef = ref<FormInstance>();
const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const illustration = computed(() =>
  dataTheme.value ? illustrationDark : illustrationLight
);

const form = reactive({
  username: "",
  displayName: "",
  password: "",
  confirmPassword: ""
});
const rules = reactive<FormRules>({
  username: [
    { required: true, message: "请输入账号", trigger: "blur" },
    {
      pattern: /^[A-Za-z0-9_.-]{3,32}$/,
      message: "账号为 3-32 位字母、数字或 ._-",
      trigger: "blur"
    }
  ],
  displayName: [
    {
      required: true,
      max: 80,
      message: "请输入不超过 80 位的显示名",
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      min: 10,
      max: 128,
      message: "密码长度为 10-128 位",
      trigger: "blur"
    }
  ],
  confirmPassword: [
    {
      validator: (_rule, value, callback) =>
        value === form.password
          ? callback()
          : callback(new Error("两次输入的密码不一致")),
      trigger: "blur"
    }
  ]
});

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await registerApi({
      username: form.username,
      displayName: form.displayName,
      password: form.password
    });
    message("注册成功，请登录", { type: "success" });
    await router.replace("/login");
  } catch {
    message("注册失败，请稍后重试", { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <el-switch v-model="dataTheme" @change="dataThemeChange" />
    </div>
    <div class="login-container">
      <div class="img"><component :is="toRaw(illustration)" /></div>
      <div class="login-box">
        <div class="login-form">
          <img :src="logo" alt="鱼搭" class="avatar" />
          <Motion
            ><h2 class="outline-hidden">注册 {{ title }}</h2></Motion
          >
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            size="large"
            @keyup.enter="submit"
          >
            <Motion :delay="100"
              ><el-form-item prop="username"
                ><el-input
                  v-model="form.username"
                  placeholder="账号"
                  :prefix-icon="useRenderIcon(User)" /></el-form-item
            ></Motion>
            <Motion :delay="150"
              ><el-form-item prop="displayName"
                ><el-input
                  v-model="form.displayName"
                  placeholder="显示名"
                  :prefix-icon="useRenderIcon(User)" /></el-form-item
            ></Motion>
            <Motion :delay="200"
              ><el-form-item prop="password"
                ><el-input
                  v-model="form.password"
                  show-password
                  placeholder="密码"
                  :prefix-icon="useRenderIcon(Lock)" /></el-form-item
            ></Motion>
            <Motion :delay="250"
              ><el-form-item prop="confirmPassword"
                ><el-input
                  v-model="form.confirmPassword"
                  show-password
                  placeholder="确认密码"
                  :prefix-icon="useRenderIcon(Lock)" /></el-form-item
            ></Motion>
            <Motion :delay="300"
              ><div class="flex items-center justify-between text-sm mb-4">
                <span>已有账号？</span
                ><el-button link type="primary" @click="router.push('/login')"
                  >返回登录</el-button
                >
              </div></Motion
            >
            <Motion :delay="350"
              ><el-button
                class="w-full"
                type="primary"
                :loading="loading"
                @click="submit"
                >注册</el-button
              ></Motion
            >
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>
