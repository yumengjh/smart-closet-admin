<script setup lang="ts">
import {
  applyAvatarCandidate,
  createAvatarCandidate,
  resetMyAvatar,
  uploadMyAvatar,
  type AvatarCandidate
} from "@/api/user";
import { useUserStoreHook } from "@/store/modules/user";
import { emitter } from "@/utils/mitt";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { onBeforeUnmount, onMounted, ref } from "vue";

const visible = ref(false);
const activeTab = ref("system");
const candidate = ref<AvatarCandidate>();
const generating = ref(false);
const applying = ref(false);
const uploading = ref(false);
const store = useUserStoreHook();

const open = () => {
  visible.value = true;
  candidate.value = undefined;
};
const generate = async () => {
  generating.value = true;
  try {
    candidate.value = (await createAvatarCandidate()).data;
  } finally {
    generating.value = false;
  }
};
const apply = async () => {
  if (!candidate.value) return;
  applying.value = true;
  try {
    await applyAvatarCandidate(candidate.value.candidateId);
    await store.loadProfile();
    candidate.value = undefined;
    visible.value = false;
    message("头像已更新", { type: "success" });
  } finally {
    applying.value = false;
  }
};
const reset = async () => {
  await ElMessageBox.confirm("将恢复为账号的初始系统头像，是否继续？", "恢复头像", {
    type: "warning"
  });
  await resetMyAvatar();
  await store.loadProfile();
  candidate.value = undefined;
  visible.value = false;
  message("已恢复初始头像", { type: "success" });
};
const upload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    message("仅支持 JPEG、PNG、WebP", { type: "warning" });
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    message("图片不能超过 5 MiB", { type: "warning" });
    return;
  }
  uploading.value = true;
  try {
    await uploadMyAvatar(file);
    await store.loadProfile();
    visible.value = false;
    message("头像上传成功", { type: "success" });
  } finally {
    uploading.value = false;
  }
};

onMounted(() => emitter.on("openAvatarManager", open));
onBeforeUnmount(() => emitter.off("openAvatarManager", open));
</script>

<template>
  <el-dialog v-model="visible" title="更换头像" width="520px">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="系统头像" name="system">
        <div class="avatar-panel">
          <el-avatar :size="136" :src="candidate?.previewUrl || store.avatar" />
          <p>{{ candidate ? "这是候选头像，确认前不会影响当前头像。" : "当前头像" }}</p>
          <div class="actions">
            <el-button :loading="generating" @click="generate">
              {{ candidate ? "换一张" : "随机生成" }}
            </el-button>
            <el-button
              v-if="candidate"
              type="primary"
              :loading="applying"
              @click="apply"
              >使用此头像</el-button
            >
            <el-button plain @click="reset">恢复初始头像</el-button>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="上传头像" name="upload">
        <div class="avatar-panel">
          <el-avatar :size="136" :src="store.avatar" />
          <p>支持静态 JPEG、PNG、WebP，最大 5 MiB；后端会自动居中裁剪。</p>
          <label class="upload-button">
            <span>{{ uploading ? "处理中…" : "选择图片" }}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploading"
              @change="upload"
            />
          </label>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<style scoped>
.avatar-panel {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 18px 0 8px;
}
.avatar-panel p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.upload-button {
  padding: 9px 18px;
  color: white;
  background: var(--el-color-primary);
  border-radius: 5px;
  cursor: pointer;
}
.upload-button input {
  display: none;
}
</style>
