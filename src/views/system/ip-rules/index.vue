<script setup lang="ts">
import {
  createIpRule,
  deleteIpRule,
  listIpRules,
  toEpochOrNull,
  type IpAccessRule,
  type IpAccessRulePayload
} from "@/api/security";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../admin-code-presentation.mjs";

defineOptions({ name: "IpRuleManagement" });
const { can } = useCurrentPermissions();
const rows = ref<IpAccessRule[]>([]);
const loading = ref(false);
const dialog = ref(false);
const expiresAt = ref<Date>();
const form = reactive<{ type: "ALLOW" | "DENY"; network: string; reason: string }>(
  { type: "DENY", network: "", reason: "" }
);
const overview = computed(() => ({
  activeBlocks: rows.value.filter(
    row => row.type === "DENY" && row.status === "ACTIVE"
  ).length,
  automaticBlocks: rows.value.filter(
    row => row.source.startsWith("AUTO_") && row.status === "ACTIVE"
  ).length,
  allowRules: rows.value.filter(
    row => row.type === "ALLOW" && row.status === "ACTIVE"
  ).length,
  history: rows.value.filter(row => row.status !== "ACTIVE").length
}));

const load = async () => {
  loading.value = true;
  try {
    rows.value = (await listIpRules()).data;
  } finally {
    loading.value = false;
  }
};
const open = () => {
  Object.assign(form, { type: "DENY", network: "", reason: "" });
  expiresAt.value = undefined;
  dialog.value = true;
};
const save = async () => {
  const data: IpAccessRulePayload = {
    ...form,
    expiresAt: toEpochOrNull(expiresAt.value)
  };
  await ElMessageBox.confirm(
    "IP 访问规则会立即生效，确认保存？",
    "高风险配置",
    { type: "warning" }
  );
  await createIpRule(data);
  dialog.value = false;
  await load();
  message("IP 规则已创建", { type: "success" });
};
const revoke = async (row: IpAccessRule) => {
  await ElMessageBox.confirm(`解除 ${row.network} 规则？`, "解除规则", {
    type: "warning"
  });
  await deleteIpRule(row.id);
  await load();
  message("IP 规则已解除", { type: "success" });
};
const formatTime = (value: number | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
const statusTag = (status: IpAccessRule["status"]) =>
  status === "ACTIVE" ? "danger" : status === "EXPIRED" ? "warning" : "info";

onMounted(load);
</script>

<template>
  <div class="page-root">
    <section class="overview-grid" aria-label="IP 防护概览">
      <div><span>当前拒绝规则</span><strong>{{ overview.activeBlocks }}</strong></div>
      <div><span>自动临时封禁</span><strong>{{ overview.automaticBlocks }}</strong></div>
      <div><span>有效允许规则</span><strong>{{ overview.allowRules }}</strong></div>
      <div><span>历史记录</span><strong>{{ overview.history }}</strong></div>
    </section>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3 page-header">
          <div>
            <b>IP 访问规则</b>
            <p>统一展示人工规则、历史迁移规则和持续触发限流产生的自动临时封禁。</p>
          </div>
          <div class="header-actions">
            <el-button :loading="loading" @click="load">刷新</el-button>
            <el-button
              v-if="can('system:config:write')"
              type="primary"
              @click="open"
            >新增人工规则</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column label="状态" width="105">
          <template #default="{ row }">
            <el-tooltip :content="adminCodeTooltip('ipRuleStatus', row.status)">
              <el-tag :type="statusTag(row.status)" effect="plain">
                {{ adminCodeLabel("ipRuleStatus", row.status) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="规则" min-width="210">
          <template #default="{ row }">
            <div class="rule-cell">
              <b>{{ row.network }}</b>
              <span>{{ adminCodeLabel("ipRuleType", row.type) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="145">
          <template #default="{ row }">
            <el-tooltip :content="adminCodeTooltip('ipRuleSource', row.source)">
              {{ adminCodeLabel("ipRuleSource", row.source) }}
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="违规/命中" width="105">
          <template #default="{ row }">{{ row.violationCount || "—" }}</template>
        </el-table-column>
        <el-table-column label="最近触发" min-width="175">
          <template #default="{ row }">{{ formatTime(row.lastTriggeredAt) }}</template>
        </el-table-column>
        <el-table-column label="到期时间" min-width="175">
          <template #default="{ row }">
            {{ row.expiresAt ? formatTime(row.expiresAt) : "永不过期" }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="240" show-overflow-tooltip />
        <el-table-column
          v-if="can('system:config:write')"
          label="操作"
          width="90"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'ACTIVE'"
              link
              type="danger"
              @click="revoke(row)"
            >解除</el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="新增人工 IP 规则" width="500px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio-button value="ALLOW">允许访问</el-radio-button>
            <el-radio-button value="DENY">拒绝访问</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="网络">
          <el-input v-model="form.network" placeholder="203.0.113.0/24" maxlength="64" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="expiresAt" type="datetime" clearable />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="form.reason" type="textarea" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-root { display: grid; gap: 16px; }
.overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.overview-grid div { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-bg-color); }
.overview-grid span,.rule-cell span,.page-header p { color: var(--el-text-color-secondary); font-size: 12px; }
.overview-grid strong { font-size: 20px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header p { margin: 5px 0 0; }
.header-actions { display: flex; gap: 8px; }
.rule-cell { display: grid; gap: 4px; }
@media (max-width: 900px) { .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
