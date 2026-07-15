<script setup lang="ts">
import { getHealth, getSystemInfo, type SystemInfo } from "@/api/security";
import { onMounted, ref } from "vue";
defineOptions({
  name: "Welcome"
});
const health = ref("加载中"),
  info = ref<SystemInfo>();
onMounted(async () => {
  try {
    health.value = (await getHealth()).status;
  } catch {
    health.value = "不可用";
  }
  try {
    info.value = (await getSystemInfo()).data;
  } catch {
    info.value = undefined;
  }
});
const open = (path: string) =>
  window.open(path, "_blank", "noopener,noreferrer");
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <el-card shadow="never"
      ><template #header>服务健康</template
      ><el-tag
        :type="
          health === 'UP' ? 'success' : health === '加载中' ? 'info' : 'danger'
        "
        >{{ health }}</el-tag
      ></el-card
    ><el-card shadow="never"
      ><template #header>版本信息</template
      ><el-descriptions :column="1" size="small"
        ><el-descriptions-item label="版本">{{
          info?.version || "-"
        }}</el-descriptions-item
        ><el-descriptions-item label="提交">{{
          info?.gitCommit || "-"
        }}</el-descriptions-item
        ><el-descriptions-item label="构建">{{
          info?.buildTime ? new Date(info.buildTime).toLocaleString() : "-"
        }}</el-descriptions-item></el-descriptions
      ></el-card
    ><el-card shadow="never"
      ><template #header>接口文档</template>
      <div class="flex gap-2">
        <el-button type="primary" @click="open('/swagger-ui/index.html')"
          >Swagger UI</el-button
        ><el-button @click="open('/v3/api-docs')">OpenAPI JSON</el-button>
      </div></el-card
    >
  </div>
</template>
