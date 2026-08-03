<script setup lang="ts">
import {
  listRuntimeChecks,
  refreshRuntimeCheck,
  refreshRuntimeChecks,
  type RuntimeComponent
} from "@/api/runtime-config";
import { getHealth, getSystemInfo, type SystemInfo } from "@/api/security";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { computed, onMounted, ref } from "vue";

defineOptions({ name: "Welcome" });

type HealthStatus = RuntimeComponent["status"];
type HealthRow = {
  code: string;
  displayName: string;
  kind: "APPLICATION" | RuntimeComponent["kind"];
  status: HealthStatus;
  message?: string;
  lastCheckedAt?: string;
  latencyMs?: number;
};

const { can } = useCurrentPermissions();
const loading = ref(false);
const refreshing = ref(false);
const rowRefreshing = ref<string>();
const applicationStatus = ref<HealthStatus>("CHECKING");
const applicationCheckedAt = ref<string>();
const checks = ref<RuntimeComponent[]>([]);
const info = ref<SystemInfo>();

const canReadChecks = computed(() => can("system:config:read"));
const canRefreshChecks = computed(() => can("system:config:write"));

const healthRows = computed<HealthRow[]>(() => [
  {
    code: "APPLICATION",
    displayName: "后端应用",
    kind: "APPLICATION",
    status: applicationStatus.value,
    message:
      applicationStatus.value === "UP"
        ? "Actuator 健康检查正常"
        : applicationStatus.value === "CHECKING"
          ? "正在检查应用状态"
          : "Actuator 健康检查不可用",
    lastCheckedAt: applicationCheckedAt.value
  },
  ...checks.value
]);

const overallStatus = computed<HealthStatus>(() => {
  if (healthRows.value.some(item => item.status === "ERROR")) return "ERROR";
  if (healthRows.value.some(item => item.status === "CHECKING"))
    return "CHECKING";
  if (healthRows.value.some(item => item.status === "UNKNOWN"))
    return "UNKNOWN";
  return "UP";
});

const statusText = (status: HealthStatus) =>
  ({
    UP: "正常",
    ERROR: "异常",
    DISABLED: "已停用",
    CHECKING: "检查中",
    UNKNOWN: "未检查"
  })[status];
const statusTagType = (status: HealthStatus) =>
  ({
    UP: "success",
    ERROR: "danger",
    DISABLED: "info",
    CHECKING: "warning",
    UNKNOWN: "info"
  })[status] as "success" | "danger" | "info" | "warning";
const hasDisabledCheck = computed(() =>
  healthRows.value.some(item => item.status === "DISABLED")
);
const overallText = computed(() =>
  overallStatus.value === "UP" && hasDisabledCheck.value
    ? "部分停用"
    : statusText(overallStatus.value)
);
const overallTagType = computed(() =>
  overallStatus.value === "UP" && hasDisabledCheck.value
    ? "info"
    : statusTagType(overallStatus.value)
);
const kindText = (kind: HealthRow["kind"]) =>
  ({
    APPLICATION: "应用服务",
    SERVICE_DEPENDENCY: "服务依赖",
    LOCAL_RESOURCE: "本地资源"
  })[kind];
const formatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "尚无记录";

const loadApplicationHealth = async () => {
  applicationStatus.value = "CHECKING";
  try {
    applicationStatus.value =
      (await getHealth()).status === "UP" ? "UP" : "ERROR";
  } catch {
    applicationStatus.value = "ERROR";
  } finally {
    applicationCheckedAt.value = new Date().toISOString();
  }
};

const load = async () => {
  loading.value = true;
  try {
    const tasks: Promise<unknown>[] = [
      loadApplicationHealth(),
      getSystemInfo()
        .then(response => {
          info.value = response.data;
        })
        .catch(() => {
          info.value = undefined;
        })
    ];
    if (canReadChecks.value)
      tasks.push(
        listRuntimeChecks().then(response => {
          checks.value = response.data;
        })
      );
    await Promise.all(tasks);
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  refreshing.value = true;
  try {
    await loadApplicationHealth();
    if (canRefreshChecks.value)
      checks.value = (await refreshRuntimeChecks()).data;
    else if (canReadChecks.value)
      checks.value = (await listRuntimeChecks()).data;
    message("服务健康状态已刷新", { type: "success" });
  } finally {
    refreshing.value = false;
  }
};

const refreshRow = async (code: string) => {
  rowRefreshing.value = code;
  try {
    const response = await refreshRuntimeCheck(code);
    const index = checks.value.findIndex(item => item.code === code);
    if (index >= 0) checks.value[index] = response.data;
    message("检查已完成", { type: "success" });
  } finally {
    rowRefreshing.value = undefined;
  }
};

const open = (path: string) =>
  window.open(path, "_blank", "noopener,noreferrer");

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="page-root welcome-page">
    <el-card data-section="service-health" shadow="never">
      <template #header>
        <div class="section-heading">
          <div>
            <div class="health-title">
              <b>服务健康</b>
              <el-tag :type="overallTagType" effect="plain">
                {{ overallText }}
              </el-tag>
            </div>
            <p>统一查看应用服务、外部依赖和本地资源的运行状态。</p>
          </div>
          <el-button :loading="refreshing" @click="refreshAll">
            刷新状态
          </el-button>
        </div>
      </template>

      <el-table :data="healthRows" row-key="code" empty-text="暂无健康检查">
        <el-table-column prop="displayName" label="检查项" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            {{ kindText(row.kind) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="plain">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="260">
          <template #default="{ row }">
            {{ row.message || "暂无检查详情" }}
          </template>
        </el-table-column>
        <el-table-column label="最近检查" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.lastCheckedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="85">
          <template #default="{ row }">
            {{ row.latencyMs == null ? "—" : row.latencyMs + " ms" }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canRefreshChecks"
          label="操作"
          width="90"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.code !== 'APPLICATION'"
              link
              type="primary"
              :loading="rowRefreshing === row.code"
              @click="refreshRow(row.code)"
            >
              重新检查
            </el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="welcome-secondary">
      <el-card shadow="never">
        <template #header>版本信息</template>
        <el-descriptions :column="1" size="small">
          <el-descriptions-item label="版本">
            {{ info?.version || "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交">
            {{ info?.gitCommit || "—" }}
          </el-descriptions-item>
          <el-descriptions-item label="构建">
            {{
              info?.buildTime ? new Date(info.buildTime).toLocaleString() : "—"
            }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>接口文档</template>
        <p class="document-description">
          查看当前后端提供的接口说明和原始 OpenAPI 定义。
        </p>
        <div class="flex gap-2">
          <el-button type="primary" @click="open('/swagger-ui/index.html')">
            Swagger UI
          </el-button>
          <el-button @click="open('/v3/api-docs')">OpenAPI JSON</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  display: grid;
  gap: 16px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading p,
.document-description {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.health-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.welcome-secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.document-description {
  margin-bottom: 14px;
}

@media (max-width: 760px) {
  .welcome-secondary {
    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: flex-start;
  }
}
</style>
