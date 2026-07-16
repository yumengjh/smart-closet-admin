<script setup lang="ts">
import {
  getGcPolicies,
  getGcRuns,
  getGcSchedule,
  runGc,
  updateGcSchedule,
  updateGcPolicy,
  type GcPolicy,
  type GcRun,
  type GcRunResource,
  type GcSchedule
} from "@/api/maintenance";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { computed, onMounted, ref } from "vue";

defineOptions({ name: "GcManagement" });

const loading = ref(false);
const running = ref(false);
const policies = ref<GcPolicy[]>([]);
const runs = ref<GcRun[]>([]);
const schedule = ref<GcSchedule>({ automaticEnabled: true, intervalMinutes: 60 });
const scheduleSaving = ref(false);
const dirtyCodes = ref<string[]>([]);
const activeTab = ref("overview");
const runType = ref<"ALL" | "PREVIEW" | "EXECUTION">("ALL");
const triggerFilter = ref<"ALL" | "MANUAL" | "SCHEDULED">("ALL");
const statusFilter = ref<"ALL" | "SUCCEEDED" | "SKIPPED" | "FAILED">("ALL");
const detail = ref<GcRun>();
const drawer = ref(false);

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
const statusLabel = (value: string) =>
  ({ SUCCEEDED: "已完成", SKIPPED: "已跳过", FAILED: "执行失败", RUNNING: "执行中" })[value] || value;
const statusType = (value: string) =>
  ({ SUCCEEDED: "success", SKIPPED: "info", FAILED: "danger", RUNNING: "warning" })[value] as
    | "success"
    | "info"
    | "danger"
    | "warning";
const sourceLabel = (value: string) => value === "SCHEDULED" ? "定时任务" : "手动发起";
const actionLabel = (run: GcRun) => run.dryRun ? "清理预览" : "真实清理";
const resourceRuns = (resourceCode: string) => runs.value.flatMap(run =>
  run.summary?.resources.filter(item => item.resourceCode === resourceCode).map(item => ({ run, item })) || []
);
const latestPreview = computed(() => runs.value.find(run => run.dryRun && run.status === "SUCCEEDED"));
const latestExecution = computed(() => runs.value.find(run => !run.dryRun && run.status === "SUCCEEDED"));
const totalPending = computed(() => latestPreview.value?.summary?.totalCandidates ?? 0);
const totalDeleted = computed(() => latestExecution.value?.summary?.totalDeleted ?? 0);
const policyHealth = computed(() => policies.value.filter(item => item.enabled && item.automaticEnabled).length);
const filteredRuns = computed(() => runs.value.filter(run =>
  (runType.value === "ALL" || (runType.value === "PREVIEW" ? run.dryRun : !run.dryRun)) &&
  (triggerFilter.value === "ALL" || run.triggerType === triggerFilter.value) &&
  (statusFilter.value === "ALL" || run.status === statusFilter.value)
));

const load = async () => {
  loading.value = true;
  try {
    const [policyResponse, runResponse, scheduleResponse] = await Promise.all([
      getGcPolicies(),
      getGcRuns({ page: 0, size: 100 }),
      getGcSchedule()
    ]);
    policies.value = policyResponse.data;
    runs.value = runResponse.data.items;
    schedule.value = scheduleResponse.data;
    dirtyCodes.value = [];
  } finally {
    loading.value = false;
  }
};
const isDirty = (policy: GcPolicy) => dirtyCodes.value.includes(policy.resourceCode);
const markDirty = (policy: GcPolicy) => {
  if (!isDirty(policy)) dirtyCodes.value = [...dirtyCodes.value, policy.resourceCode];
};
const save = async (policy: GcPolicy, quiet = false) => {
  const { data } = await updateGcPolicy(policy.resourceCode, policy);
  Object.assign(policy, data);
  dirtyCodes.value = dirtyCodes.value.filter(code => code !== policy.resourceCode);
  if (!quiet) message(`${policy.displayName}策略已保存`, { type: "success" });
};
const saveSchedule = async () => {
  scheduleSaving.value = true;
  try {
    schedule.value = (await updateGcSchedule(schedule.value)).data;
    message("自动清理计划已保存", { type: "success" });
  } finally {
    scheduleSaving.value = false;
  }
};
const saveBeforeRun = async (resourceCodes?: string[]) => {
  const target = resourceCodes
    ? policies.value.filter(policy => resourceCodes.includes(policy.resourceCode))
    : policies.value;
  await Promise.all(target.filter(isDirty).map(policy => save(policy, true)));
};
const run = async (dryRun: boolean, resourceCodes?: string[]) => {
  await saveBeforeRun(resourceCodes);
  if (!dryRun) {
    await ElMessageBox.confirm(
      resourceCodes?.length ? "将立即删除该资源中符合策略的数据，是否继续？" : "将按当前策略执行真实数据清理，是否继续？",
      "确认执行真实清理",
      { type: "warning", confirmButtonText: "确认清理", cancelButtonText: "取消" }
    );
  }
  running.value = true;
  try {
    const { data } = await runGc(dryRun, resourceCodes);
    message(dryRun ? "预览已生成，可在运行记录查看影响范围" : "真实清理已完成", { type: "success" });
    await load();
    detail.value = data;
    drawer.value = true;
  } finally {
    running.value = false;
  }
};
const lastFor = (policy: GcPolicy, dryRun: boolean) => resourceRuns(policy.resourceCode)
  .find(({ run }) => run.dryRun === dryRun && run.status === "SUCCEEDED");
const openDetail = (run: GcRun) => { detail.value = run; drawer.value = true; };
const resultText = (item: GcRunResource, dryRun: boolean) => dryRun
  ? `发现 ${item.candidates} 条待清理数据`
  : `清理 ${item.deleted} 条${item.candidates !== item.deleted ? `（扫描 ${item.candidates} 条）` : ""}`;

onMounted(load);
</script>

<template>
  <div class="gc-page" v-loading="loading">
    <section class="gc-toolbar">
      <div>
        <h2>数据清理中心</h2>
        <p>预览影响范围后，再执行真实清理。</p>
      </div>
      <div class="gc-toolbar-actions">
        <el-button :loading="running" @click="run(true)">生成清理预览</el-button>
        <el-button type="danger" :loading="running" @click="run(false)">执行全部清理</el-button>
      </div>
    </section>

    <el-alert type="info" :closable="false" show-icon class="gc-tip">
      <template #title>预览不会删除数据；真实清理仅处理符合各资源保留策略的数据。</template>
    </el-alert>

    <el-tabs v-model="activeTab" class="gc-tabs">
      <el-tab-pane label="运行概览" name="overview">
        <div class="metrics-grid">
          <el-card shadow="never" class="metric-card"><span>上次真实清理</span><strong>{{ formatDate(latestExecution?.completedAt) }}</strong><small>{{ latestExecution ? `共清理 ${totalDeleted} 条数据` : "暂未执行" }}</small></el-card>
          <el-card shadow="never" class="metric-card"><span>最近预览待清理</span><strong>{{ totalPending.toLocaleString() }} <em>条</em></strong><small>{{ latestPreview ? formatDate(latestPreview.completedAt) : "请先生成预览" }}</small></el-card>
          <el-card shadow="never" class="metric-card"><span>自动维护资源</span><strong>{{ policyHealth }} <em>/ {{ policies.length }}</em></strong><small>已启用且参与定时任务的资源</small></el-card>
          <el-card shadow="never" class="metric-card"><span>最近任务状态</span><strong><el-tag :type="statusType(runs[0]?.status || 'SKIPPED')" effect="light">{{ runs[0] ? statusLabel(runs[0].status) : "暂无记录" }}</el-tag></strong><small>{{ runs[0] ? `${actionLabel(runs[0])} · ${sourceLabel(runs[0].triggerType)}` : "" }}</small></el-card>
        </div>
        <el-card shadow="never" class="overview-card">
          <template #header><div class="card-title"><div><b>资源状态</b><span>将最近一次预览与真实执行分开展示</span></div><el-button link type="primary" @click="activeTab = 'policies'">管理策略</el-button></div></template>
          <div class="resource-health-grid">
            <article v-for="policy in policies" :key="policy.resourceCode" class="resource-health-card">
              <div class="resource-health-head"><div><b>{{ policy.displayName }}</b><p>{{ policy.description }}</p></div><el-tag :type="policy.enabled ? 'success' : 'info'" effect="plain">{{ policy.enabled ? '已启用' : '已暂停' }}</el-tag></div>
              <div class="resource-health-values"><div><span>预览待清理</span><strong>{{ lastFor(policy, true)?.item.candidates ?? '—' }}</strong></div><div><span>上次实际清理</span><strong>{{ lastFor(policy, false)?.item.deleted ?? '—' }}</strong></div></div>
              <p class="resource-health-time">{{ lastFor(policy, false) ? `真实清理于 ${formatDate(lastFor(policy, false)?.run.completedAt)}` : '尚无真实清理记录' }}</p>
            </article>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="资源策略" name="policies">
        <el-card shadow="never" class="schedule-card">
          <template #header><div class="policy-card-head"><div><b>自动清理计划</b><p>定时任务每分钟检查一次，到达设定间隔后执行所有已开启“参与定时清理”的资源。</p></div><el-switch v-model="schedule.automaticEnabled" :loading="scheduleSaving" inline-prompt active-text="开" inactive-text="关" @change="saveSchedule" /></div></template>
          <div class="schedule-body"><label>执行间隔<el-input-number v-model="schedule.intervalMinutes" :disabled="scheduleSaving" :min="1" :max="1440" controls-position="right" @change="saveSchedule" /></label><span>分钟</span><small>关闭自动清理后，仍可在本页手动预览和执行，不会影响已有策略。</small></div>
        </el-card>
        <div class="policy-grid">
          <el-card v-for="policy in policies" :key="policy.resourceCode" shadow="never" class="policy-card">
            <template #header><div class="policy-card-head"><div><b>{{ policy.displayName }}</b><p>{{ policy.description }}</p></div><el-switch v-model="policy.enabled" inline-prompt active-text="开" inactive-text="关" @change="markDirty(policy)" /></div></template>
            <div class="policy-form">
              <label>保留天数<el-input-number v-model="policy.retentionDays" :min="0" :max="3650" controls-position="right" @change="markDirty(policy)" /></label>
              <label>单批上限<el-input-number v-model="policy.batchSize" :min="1" :max="5000" controls-position="right" @change="markDirty(policy)" /></label>
              <label class="switch-line"><span>参与定时清理<small>关闭后仅可手动执行</small></span><el-switch v-model="policy.automaticEnabled" @change="markDirty(policy)" /></label>
            </div>
            <div class="policy-footer"><span>{{ isDirty(policy) ? '策略尚未保存；预览或清理前会自动保存' : policy.retentionDays === 0 ? '保留期为 0 时，持久化数据不会被清理' : `超过 ${policy.retentionDays} 天的数据将纳入清理范围` }}</span><div><el-button v-if="isDirty(policy)" link type="primary" @click="save(policy)">保存策略</el-button><el-button link @click="run(true, [policy.resourceCode])">预览</el-button><el-button link type="danger" @click="run(false, [policy.resourceCode])">立即清理</el-button></div></div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="运行记录" name="history">
        <el-card shadow="never">
          <template #header><div class="history-header"><div><b>任务历史</b><span>预览与真实清理独立标识，点击记录查看资源级结果</span></div><el-button link type="primary" @click="load">刷新</el-button></div></template>
          <div class="history-filters">
            <el-radio-group v-model="runType"><el-radio-button value="ALL">全部</el-radio-button><el-radio-button value="PREVIEW">仅预览</el-radio-button><el-radio-button value="EXECUTION">仅真实清理</el-radio-button></el-radio-group>
            <el-select v-model="triggerFilter" class="filter-select"><el-option label="全部来源" value="ALL"/><el-option label="手动发起" value="MANUAL"/><el-option label="定时任务" value="SCHEDULED"/></el-select>
            <el-select v-model="statusFilter" class="filter-select"><el-option label="全部状态" value="ALL"/><el-option label="已完成" value="SUCCEEDED"/><el-option label="已跳过" value="SKIPPED"/><el-option label="执行失败" value="FAILED"/></el-select>
          </div>
          <el-table :data="filteredRuns" empty-text="暂无匹配的运行记录" @row-click="openDetail">
            <el-table-column label="任务" min-width="150"><template #default="{ row }"><div class="task-name"><b>{{ actionLabel(row) }}</b><span>{{ sourceLabel(row.triggerType) }}</span></div></template></el-table-column>
            <el-table-column label="执行状态" width="110"><template #default="{ row }"><el-tag :type="statusType(row.status)" effect="light">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="影响结果" min-width="260"><template #default="{ row }"><div v-if="row.summary" class="result-pills"><el-tag v-for="item in row.summary.resources" :key="item.resourceCode" effect="plain" :type="row.dryRun ? 'warning' : 'success'">{{ item.resourceCode }} · {{ row.dryRun ? `待清理 ${item.candidates}` : `已清理 ${item.deleted}` }}</el-tag></div><span v-else class="muted">{{ row.errorMessage || '未产生清理结果' }}</span></template></el-table-column>
            <el-table-column label="完成时间" min-width="180"><template #default="{ row }">{{ formatDate(row.completedAt || row.startedAt) }}</template></el-table-column>
            <el-table-column label="操作" width="80" fixed="right"><template #default="{ row }"><el-button link type="primary" @click.stop="openDetail(row)">详情</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="drawer" :title="detail ? `${actionLabel(detail)}详情` : '运行详情'" size="520px">
      <template v-if="detail"><div class="run-detail"><el-descriptions :column="1" border><el-descriptions-item label="执行类型"><el-tag :type="detail.dryRun ? 'warning' : 'danger'">{{ actionLabel(detail) }}</el-tag></el-descriptions-item><el-descriptions-item label="发起来源">{{ sourceLabel(detail.triggerType) }}</el-descriptions-item><el-descriptions-item label="任务状态"><el-tag :type="statusType(detail.status)">{{ statusLabel(detail.status) }}</el-tag></el-descriptions-item><el-descriptions-item label="开始时间">{{ formatDate(detail.startedAt) }}</el-descriptions-item><el-descriptions-item label="完成时间">{{ formatDate(detail.completedAt) }}</el-descriptions-item><el-descriptions-item v-if="detail.errorMessage" label="失败原因">{{ detail.errorMessage }}</el-descriptions-item></el-descriptions><el-divider content-position="left">资源执行结果</el-divider><el-empty v-if="!detail.summary" description="此任务未产生可展示的资源结果"/><div v-else class="detail-results"><article v-for="item in detail.summary.resources" :key="item.resourceCode"><div><b>{{ item.resourceCode }}</b><span>{{ item.message }}</span></div><strong>{{ resultText(item, detail.dryRun) }}</strong></article><div class="detail-total"><span>总计</span><b>{{ detail.dryRun ? `发现 ${detail.summary.totalCandidates} 条待清理数据` : `实际清理 ${detail.summary.totalDeleted} 条数据` }}</b></div></div><el-divider v-if="detail.traceId" content-position="left">调试信息</el-divider><p v-if="detail.traceId" class="trace-id">Trace ID：{{ detail.traceId }}</p></div></template>
    </el-drawer>
  </div>
</template>

<style scoped>
.gc-page { padding: 20px; max-width: 1500px; margin: 0 auto; }.gc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; }.gc-toolbar h2 { margin: 0; font-size: 20px; }.gc-toolbar p { margin: 5px 0 0; color: var(--el-text-color-secondary); font-size: 13px; }.gc-toolbar-actions { flex: none; white-space: nowrap; }.gc-tip { margin-top: 16px; }.gc-tabs { margin-top: 10px; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }.metric-card :deep(.el-card__body) { display: grid; min-height: 122px; align-content: space-between; }.metric-card span,.metric-card small { color: var(--el-text-color-secondary); }.metric-card strong { color: var(--el-text-color-primary); font-size: 22px; }.metric-card em { font-size: 14px; font-style: normal; font-weight: 500; }.overview-card { margin-top: 16px; }.card-title,.history-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.card-title b,.history-header b { display: block; }.card-title span,.history-header span { display: block; margin-top: 5px; color: var(--el-text-color-secondary); font-size: 13px; }
.resource-health-grid,.policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.resource-health-card { padding: 17px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }.resource-health-head,.policy-card-head { display: flex; justify-content: space-between; gap: 16px; }.resource-health-head b,.policy-card-head b { font-size: 15px; }.resource-health-head p,.policy-card-head p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.5; }.resource-health-values { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px 0; }.resource-health-values div { display: grid; gap: 5px; }.resource-health-values span,.resource-health-time { color: var(--el-text-color-secondary); font-size: 12px; }.resource-health-values strong { font-size: 20px; }.resource-health-time { margin: 0; }
.schedule-card { margin-bottom: 16px; }.schedule-body { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; color: var(--el-text-color-secondary); font-size: 13px; }.schedule-body label { display: flex; align-items: center; gap: 10px; color: var(--el-text-color-primary); }.schedule-body :deep(.el-input-number) { width: 150px; }.schedule-body small { width: 100%; }.policy-card :deep(.el-card__header) { padding-bottom: 15px; }.policy-form { display: grid; gap: 15px; }.policy-form label { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }.policy-form :deep(.el-input-number) { width: 156px; }.switch-line span { display: grid; gap: 4px; }.switch-line small { color: var(--el-text-color-secondary); }.policy-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-secondary); font-size: 12px; }.policy-footer > span { max-width: 56%; line-height: 1.45; }
.history-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }.filter-select { width: 130px; }.task-name { display: grid; gap: 3px; }.task-name span,.muted { color: var(--el-text-color-secondary); font-size: 12px; }.result-pills { display: flex; flex-wrap: wrap; gap: 6px; }.run-detail { padding: 0 4px; }.detail-results { display: grid; gap: 10px; }.detail-results article,.detail-total { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 14px; border-radius: 7px; background: var(--el-fill-color-lighter); }.detail-results article div { display: grid; gap: 4px; }.detail-results article span { color: var(--el-text-color-secondary); font-size: 12px; }.detail-results article strong { color: var(--el-color-primary); font-size: 13px; }.detail-total { margin-top: 2px; background: #eff6ff; }.detail-total b { color: #1d4ed8; }.trace-id { overflow-wrap: anywhere; color: var(--el-text-color-secondary); font-family: monospace; font-size: 12px; }
@media (max-width: 900px) { .gc-page { padding: 14px; }.gc-toolbar { align-items: flex-start; flex-direction: column; }.gc-toolbar-actions { width: 100%; display: flex; }.gc-toolbar-actions .el-button { flex: 1; }.metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.resource-health-grid,.policy-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .gc-page { padding: 10px; }.metrics-grid { grid-template-columns: 1fr; }.resource-health-values { padding-bottom: 12px; }.policy-footer { align-items: flex-start; flex-direction: column; }.policy-footer > span { max-width: none; }.policy-footer > div { align-self: flex-end; }.history-header { align-items: flex-start; }.history-filters { display: grid; grid-template-columns: 1fr; }.filter-select { width: 100%; }.result-pills { max-width: 240px; }.detail-results article { align-items: flex-start; flex-direction: column; gap: 8px; } }
</style>
