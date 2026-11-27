<script setup lang="ts">
import { useWindowSize } from "@vueuse/core";
const { width } = useWindowSize();
import { onMounted, ref, watch } from "vue";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import {
  getClosetOps,
  getClosetAssistantTokenBudget,
  getClosetMailUsage,
  getClosetMonitor,
  getClosetTasks,
  getClosetOperationLog,
  type MailUsage,
  type MonitorStatus,
  type OpsStatus,
  type SiteTokenBudget,
  type Page,
  type Task,
  type TaskStatus,
  type OperationLog
} from "@/api/closet/management";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import {
  useClosetRequest,
  formatTime,
  percent,
  bytes
} from "../useClosetRequest";
defineOptions({ name: "ClosetOps" });
const { can } = useCurrentPermissions();
const poolNames: Record<string, string> = {
  VISION: "识图", CHAT: "对话", IMAGE_PREMIUM: "生图 · 高质量",
  IMAGE_STANDARD: "生图 · 标准", PORTRAIT_PREMIUM: "形象图 · 高质量", PORTRAIT_STANDARD: "形象图 · 标准"
};
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const tab = ref("status");
const health = ref<OpsStatus>();
const tokenBudget = ref<SiteTokenBudget>();
const mail = ref<MailUsage>();
const monitor = ref<MonitorStatus>();
const mailDays = ref(7);
const mailPurposeNames: Record<string, string> = {
  REGISTER_CODE: "注册验证码",
  REGISTER_EXISTS: "注册（邮箱已注册提示）",
  BIND_CODE: "绑定邮箱验证码",
  RESET_CODE: "找回密码验证码",
  SECURITY_NOTICE: "安全提醒",
  ALERT: "监控告警",
  TEST: "测试邮件"
};
const mailStatusNames: Record<string, string> = {
  PENDING: "发送中",
  SENT: "已发送",
  FAILED: "失败",
  DROPPED_LIMIT: "超额丢弃"
};
const mailErrorNames: Record<string, string> = {
  AUTH: "认证失败",
  CONNECT: "连接失败",
  TIMEOUT: "超时",
  REJECTED: "被拒收",
  OTHER: "其他"
};
const monitorRuleNames: Record<string, string> = {
  memory: "物理内存",
  heap: "堆内存",
  disk: "磁盘",
  database: "数据库",
  agent: "健康检查",
  "model-calls": "模型调用",
  jobs: "后台任务",
  errors: "错误日志"
};
const databaseNames: Record<string, string> = {
  H2: "H2（开发或便携版）",
  POSTGRESQL: "PostgreSQL"
};
const tokens = (value: number) => value.toLocaleString();
const tokenLimit = (value: number) => (value > 0 ? tokens(value) : "不设上限");
const tokenPercent = (used: number, limit: number) =>
  limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
const tasks = ref<Page<Task>>();
const logs = ref<Page<OperationLog>>();
const statuses: TaskStatus[] = [
  "FAILED",
  "QUEUED",
  "RUNNING",
  "WAITING_QUOTA",
  "SUCCEEDED",
  "CANCELLED"
];
const statusFilter = ref<TaskStatus[]>(["FAILED"]);
const kind = ref("");
const action = ref("");
const target = ref("");
const logRange = ref<[string, string] | null>(null);
const page = ref(1);
const size = ref(20);
const load = () =>
  run(
    async () => {
      if (tab.value === "status") {
        // An older closet may lack the budget route; health still shows without it.
        const [ops, budget] = await Promise.all([
          getClosetOps(),
          getClosetAssistantTokenBudget().catch(() => undefined)
        ]);
        return { health: ops.data, tokenBudget: budget?.data };
      }
      if (tab.value === "mail")
        return { mail: (await getClosetMailUsage(mailDays.value)).data };
      if (tab.value === "monitor")
        return { monitor: (await getClosetMonitor()).data };
      if (tab.value === "tasks")
        return {
          tasks: (
            await getClosetTasks({
              status: statusFilter.value.length
                ? statusFilter.value
                : undefined,
              kind: kind.value || undefined,
              page: page.value - 1,
              size: size.value
            })
          ).data
        };
      return {
        logs: (
          await getClosetOperationLog({
            action: action.value || undefined,
            targetUsername: target.value || undefined,
            from: logRange.value?.[0],
            to: logRange.value?.[1],
            page: page.value - 1,
            size: size.value
          })
        ).data
      };
    },
    result => {
      health.value = result.health;
      tokenBudget.value = result.tokenBudget;
      mail.value = result.mail;
      monitor.value = result.monitor;
      tasks.value = result.tasks;
      logs.value = result.logs;
    }
  );
const search = () => {
  page.value = 1;
  void load();
};
watch(tab, search);
onMounted(() => void load());
</script>
<template>
  <div class="space-y-4">
    <el-card shadow="never"
      ><div class="flex flex-wrap items-center gap-3">
        <h2 class="mr-auto text-lg font-semibold">运行监控</h2>
        <el-button type="primary" :loading="loading" @click="load"
          >刷新</el-button
        >
      </div>
      <p class="mt-2 text-sm">
        查看鱼搭服务与任务状态，操作日志记录管理接口的变更。
      </p>
      <el-tabs v-model="tab" class="mt-3"
        ><el-tab-pane label="服务健康" name="status" /><el-tab-pane
          label="邮件"
          name="mail" /><el-tab-pane
          label="监控规则"
          name="monitor" /><el-tab-pane
          label="后台任务"
          name="tasks" /><el-tab-pane label="操作日志" name="logs"
      /></el-tabs>
      <div v-if="tab === 'mail'" class="flex flex-wrap items-center gap-3">
        <span class="text-sm">统计最近</span
        ><el-input-number
          v-model="mailDays"
          :min="1"
          :max="30"
          :precision="0"
          aria-label="统计天数"
        /><span class="text-sm">天</span
        ><el-button @click="search">查询</el-button>
      </div>
      <div v-if="tab === 'tasks'" class="flex flex-wrap gap-3">
        <el-select
          v-model="statusFilter"
          multiple
          class="!w-80"
          aria-label="任务状态"
          ><el-option
            v-for="s in statuses"
            :key="s"
            :value="s"
            :label="s" /></el-select
        ><el-input
          v-model="kind"
          class="!w-60"
          placeholder="任务类型，如 SEMANTIC_INDEX"
          clearable
        /><el-button @click="search">查询</el-button>
      </div>
      <div v-if="tab === 'logs'" class="flex flex-wrap gap-3">
        <el-date-picker
          v-model="logRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        /><el-input
          v-model="action"
          class="!w-48"
          placeholder="操作动作"
          clearable
        /><el-input
          v-model="target"
          class="!w-48"
          placeholder="目标业务用户名"
          clearable
        /><el-button @click="search">查询</el-button>
      </div>
    </el-card>
    <ClosetUnavailable
      v-if="unavailable"
      :loading="loading"
      @retry="load"
    /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <div v-else v-loading="loading" class="space-y-4">
      <template v-if="tab === 'status' && health">
        <el-card shadow="never"
          ><template #header
            ><div class="flex flex-wrap justify-between gap-2">
              <el-tag :type="health.status === 'UP' ? 'success' : 'warning'">{{
                health.status === "UP" ? "服务正常" : "服务需关注"
              }}</el-tag
              ><span class="text-sm">{{
                formatTime(health.generatedAtMs)
              }}</span>
            </div></template
          >
          <el-alert
            v-for="issue in health.issues"
            :key="issue.code"
            class="mb-3"
            :title="issue.message"
            :description="issue.code"
            type="warning"
            :closable="false"
          />
          <el-descriptions :column="width < 768 ? 1 : 2" border
            ><el-descriptions-item label="包版本">{{
              health.app.version
            }}</el-descriptions-item
            ><el-descriptions-item label="发版版本">{{
              health.app.buildVersion || "未提供"
            }}</el-descriptions-item
            ><el-descriptions-item label="提交号">{{
              health.app.commit || "未提供"
            }}</el-descriptions-item
            ><el-descriptions-item label="运行时长"
              >{{
                Math.floor(health.app.uptimeMs / 60000)
              }}
              分钟</el-descriptions-item
            ><el-descriptions-item label="Java">{{
              health.app.java
            }}</el-descriptions-item
            ><el-descriptions-item label="在线 / 会话"
              >{{ health.sessions.onlineLast5Min }} /
              {{ health.sessions.active }}</el-descriptions-item
            ><el-descriptions-item label="堆内存"
              >{{ bytes(health.jvm.heapUsedBytes) }} /
              {{ bytes(health.jvm.heapMaxBytes) }}</el-descriptions-item
            ><el-descriptions-item label="进程常驻内存">{{
              bytes(health.jvm.processRssBytes)
            }}</el-descriptions-item
            ><el-descriptions-item label="非堆 / 线程"
              >{{ bytes(health.jvm.nonHeapUsedBytes) }} /
              {{ health.jvm.threads }}</el-descriptions-item
            ><el-descriptions-item label="CPU / 负载"
              >{{ percent(health.jvm.processCpuLoad) }} /
              {{ health.jvm.systemLoadAverage }}</el-descriptions-item
            ><el-descriptions-item label="磁盘使用率">{{
              health.storage.error ?? percent(health.storage.usedRatio)
            }}</el-descriptions-item
            ><el-descriptions-item label="磁盘可用 / 数据库"
              >{{ bytes(health.storage.usableBytes) }} /
              {{ bytes(health.storage.databaseBytes) }}</el-descriptions-item
            ><el-descriptions-item label="物理内存可用 / 总量"
              >{{ bytes(health.jvm.systemMemoryFreeBytes) }} /
              {{
                bytes(health.jvm.systemMemoryTotalBytes)
              }}</el-descriptions-item
            ><el-descriptions-item label="CPU 核数">{{
              health.jvm.processors
            }}</el-descriptions-item></el-descriptions
          >
        </el-card>
        <el-card shadow="never"
          ><template #header
            ><div class="flex flex-wrap items-center justify-between gap-2">
              <span>数据库</span
              ><span class="text-sm text-[var(--el-text-color-secondary)]"
                >类型与迁移版本</span
              >
            </div></template
          >
          <el-descriptions
            v-if="health.database"
            :column="width < 768 ? 1 : 2"
            border
            ><el-descriptions-item label="类型">{{
              databaseNames[health.database.vendor] ?? health.database.vendor
            }}</el-descriptions-item
            ><el-descriptions-item label="迁移版本">{{
              health.database.schemaVersion ?? "未取到"
            }}</el-descriptions-item
            ><el-descriptions-item label="库文件大小">{{
              bytes(health.storage.databaseBytes)
            }}</el-descriptions-item></el-descriptions
          >
          <p v-else class="text-sm">
            当前鱼搭版本没有提供数据库信息。
          </p></el-card
        >
        <el-card v-if="tokenBudget" shadow="never"
          ><template #header
            ><div class="flex flex-wrap justify-between gap-2">
              <span>助手 token 预算</span
              ><span class="text-sm text-[var(--el-text-color-secondary)]"
                >按北京时间每日重置，下次
                {{ formatTime(tokenBudget.resetAtMs) }}</span
              >
            </div></template
          >
          <el-descriptions :column="width < 768 ? 1 : 2" border
            ><el-descriptions-item label="全站今日已用 / 日限额"
              >{{ tokens(tokenBudget.site.used) }} /
              {{ tokenLimit(tokenBudget.site.limit) }}</el-descriptions-item
            ><el-descriptions-item label="账号默认日限额">{{
              tokenLimit(tokenBudget.userDefault.limit)
            }}</el-descriptions-item></el-descriptions
          >
          <el-progress
            v-if="tokenBudget.site.limit > 0"
            class="mt-3"
            :percentage="
              tokenPercent(tokenBudget.site.used, tokenBudget.site.limit)
            "
            :status="
              tokenBudget.site.used >= tokenBudget.site.limit
                ? 'exception'
                : undefined
            "
          />
          <p class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
            限额来自鱼搭部署配置，此处只读；单个账号的覆盖值在业务用户详情的“AI
            额度”中设置。
          </p></el-card
        >
        <el-card shadow="never"
          ><template #header>索引与队列</template
          ><el-table
            :data="
              Object.entries(health.indexes).map(([name, item]) => ({
                name,
                ...item
              }))
            "
            ><el-table-column prop="name" label="索引" /><el-table-column
              label="覆盖率"
              ><template #default="{ row }">{{
                percent(row.coverage)
              }}</template></el-table-column
            ><el-table-column prop="total" label="总量" /><el-table-column
              label="已处理"
              ><template #default="{ row }">{{
                row.indexed ?? row.measured ?? "—"
              }}</template></el-table-column
            ></el-table
          >
          <p class="my-4 text-sm">
            排队最久
            {{
              health.queue.oldestQueuedAgeMs == null
                ? "—"
                : `${Math.floor(health.queue.oldestQueuedAgeMs / 60000)} 分钟`
            }}
            · 24 小时失败 {{ health.queue.failed24h }} ·
            {{
              Object.entries(health.queue.byStatus)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" / ")
            }}
          </p>
          <el-table :data="health.queue.byKind"
            ><el-table-column prop="kind" label="任务类型" /><el-table-column
              prop="queued"
              label="排队" /><el-table-column
              prop="running"
              label="运行" /><el-table-column
              prop="waitingQuota"
              label="等待额度" /><el-table-column
              prop="failed24h"
              label="24h 失败" /></el-table
        ></el-card>
        <el-card shadow="never"
          ><template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><h2 class="text-base">本地模型与服务商</h2>
                <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">查看模型池可用情况、降级状态和未恢复告警。</p></div>
              <router-link v-if="can('closet:models:read')" to="/closet/models">去模型调配</router-link>
            </div></template
          >
          <p class="mb-3 text-sm">
            <router-link v-if="can('closet:models:read') && health.providers.alertsFiring != null" :to="{ path: '/closet/models', query: { tab: 'alerts' } }" class="text-[var(--el-color-danger)]">未恢复告警 {{ health.providers.alertsFiring }} 条</router-link>
            <span v-else>未恢复告警 {{ health.providers.alertsFiring ?? '—' }} 条</span>
          </p>
          <el-table :data="health.providers.pools ?? []" empty-text="还没配置模型池，适用的用途使用部署默认模型。" class="mb-4">
            <el-table-column label="模型池"><template #default="{ row }">{{ poolNames[row.pool] ?? row.pool }}</template></el-table-column>
            <el-table-column label="可用 / 总数"><template #default="{ row }">{{ row.available }} / {{ row.total }}</template></el-table-column>
            <el-table-column label="正在降级"><template #default="{ row }">{{ row.degraded ? '是' : '否' }}</template></el-table-column>
          </el-table>
          <el-collapse
            ><el-collapse-item
              v-for="[name, value] in Object.entries({
                ...health.models,
                ...health.providers
              })"
              :key="name"
              :title="name"
            >
              <pre class="overflow-auto text-sm">{{
                JSON.stringify(value, null, 2)
              }}</pre>
            </el-collapse-item></el-collapse
          ></el-card
        >
      </template>
      <template v-if="tab === 'mail' && mail">
        <p class="text-xs text-[var(--el-text-color-secondary)]">
          鱼搭邮件模块的发信情况：验证码、找回密码、安全提醒与告警。只显示用途和结果的计数，不含收件地址和内容。邮件关闭时这里只有历史记录。
        </p>
        <el-card shadow="never"
          ><template #header
            ><div class="flex flex-wrap justify-between gap-2">
              <el-tag :type="mail.enabled ? 'success' : 'info'">{{
                mail.enabled ? "邮件模块已开启" : "邮件模块未开启"
              }}</el-tag
              ><el-tag
                v-if="mail.enabled"
                :type="mail.available ? 'success' : 'warning'"
                >{{
                  mail.available ? "配置齐全，可发信" : "配置不全，暂不能发信"
                }}</el-tag
              >
            </div></template
          >
          <el-descriptions :column="width < 768 ? 1 : 2" border
            ><el-descriptions-item label="今日已发 / 日上限"
              >{{ mail.usedToday }} /
              {{ mail.dailyLimit }}</el-descriptions-item
            ><el-descriptions-item label="普通邮件上限（其余留给告警）">{{
              mail.ordinaryLimit
            }}</el-descriptions-item
            ><el-descriptions-item label="投递记录保留"
              >{{ mail.logRetentionDays }} 天</el-descriptions-item
            ></el-descriptions
          >
          <p class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
            只统计用途、状态与错误分类，不含收件人、主题与正文。日期按北京时间。
          </p>
        </el-card>
        <el-card shadow="never"
          ><template #header>最近 {{ mail.days }} 天投递</template
          ><el-table :data="mail.byDay" empty-text="这段时间没有投递记录"
            ><el-table-column
              prop="date"
              label="日期"
              width="130" /><el-table-column label="用途" min-width="150"
              ><template #default="{ row }">{{
                mailPurposeNames[row.purpose] ?? row.purpose
              }}</template></el-table-column
            ><el-table-column label="结果" width="110"
              ><template #default="{ row }">{{
                mailStatusNames[row.status] ?? row.status
              }}</template></el-table-column
            ><el-table-column prop="count" label="数量" width="90"
          /></el-table>
          <template v-if="mail.errors.length"
            ><h3 class="mt-4 mb-2 text-sm font-semibold">错误分类</h3>
            <el-table :data="mail.errors"
              ><el-table-column label="分类"
                ><template #default="{ row }">{{
                  mailErrorNames[row.errorKind] ?? row.errorKind
                }}</template></el-table-column
              ><el-table-column prop="count" label="数量" /></el-table
          ></template>
        </el-card>
      </template>
      <template v-if="tab === 'monitor' && monitor">
        <p class="text-xs text-[var(--el-text-color-secondary)]">
          鱼搭服务内的每分钟自检（内存、堆、磁盘、数据库、助手、模型调用、任务积压、错误日志）。触发后按设置发告警邮件，这里只读，规则改动需改部署配置。
        </p>
        <el-card shadow="never"
          ><template #header
            ><div class="flex flex-wrap justify-between gap-2">
              <el-tag :type="monitor.enabled ? 'success' : 'info'">{{
                monitor.enabled ? "监控已开启" : "监控未开启"
              }}</el-tag
              ><span v-if="monitor.enabled" class="text-sm"
                >每 {{ monitor.intervalSeconds }} 秒检查 ·
                {{
                  monitor.alertConfigured
                    ? "已配置告警收件人"
                    : "未配置告警收件人"
                }}</span
              >
            </div></template
          >
          <el-table
            :data="monitor.rules"
            empty-text="监控未开启，没有规则状态"
            :row-class-name="({ row }) => (row.firing ? 'firing-row' : '')"
            ><el-table-column label="规则" min-width="110"
              ><template #default="{ row }">{{
                monitorRuleNames[row.rule] ?? row.rule
              }}</template></el-table-column
            ><el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><el-tag
                  :type="
                    row.firing
                      ? 'danger'
                      : row.lastCheckedMs == null
                        ? 'info'
                        : 'success'
                  "
                  >{{
                    row.firing
                      ? "告警中"
                      : row.lastCheckedMs == null
                        ? "未检查"
                        : "正常"
                  }}</el-tag
                ></template
              ></el-table-column
            ><el-table-column label="告警起始" min-width="170"
              ><template #default="{ row }">{{
                formatTime(row.sinceMs)
              }}</template></el-table-column
            ><el-table-column label="当前读数" min-width="160"
              ><template #default="{ row }">{{
                row.reading ?? "—"
              }}</template></el-table-column
            ><el-table-column
              prop="threshold"
              label="阈值"
              min-width="200"
              show-overflow-tooltip
            /><el-table-column label="最近检查" min-width="170"
              ><template #default="{ row }">{{
                formatTime(row.lastCheckedMs)
              }}</template></el-table-column
            ></el-table
          >
          <p class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
            监控规则只读；告警邮件不含用户名与任何用户内容。
          </p>
        </el-card>
      </template>
      <el-card v-if="tab === 'tasks' && tasks" shadow="never"
        ><el-table :data="tasks.items" row-key="id"
          ><el-table-column type="expand"
            ><template #default="{ row }"
              ><el-descriptions class="p-4" :column="width < 768 ? 1 : 2" border
                ><el-descriptions-item label="任务 ID">{{
                  row.id
                }}</el-descriptions-item
                ><el-descriptions-item label="阶段 / 重试"
                  >{{ row.stage }} / {{ row.attempts }}</el-descriptions-item
                ><el-descriptions-item label="线程池 / 优先级"
                  >{{ row.pool }} / {{ row.priority }}</el-descriptions-item
                ><el-descriptions-item label="下次运行">{{
                  formatTime(row.nextRunAtMs)
                }}</el-descriptions-item
                ><el-descriptions-item label="等待原因">{{
                  row.waitReason ?? "—"
                }}</el-descriptions-item
                ><el-descriptions-item label="创建时间">{{
                  formatTime(row.createdAtMs)
                }}</el-descriptions-item></el-descriptions
              ></template
            ></el-table-column
          ><el-table-column
            prop="kind"
            label="类型"
            min-width="150"
          /><el-table-column
            prop="ownerUsername"
            label="业务用户"
          /><el-table-column
            prop="status"
            label="状态"
            min-width="130"
          /><el-table-column
            prop="errorMessage"
            label="异常"
            min-width="220"
            show-overflow-tooltip
          /><el-table-column label="更新时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.updatedAtMs)
            }}</template></el-table-column
          ></el-table
        ></el-card
      >
      <el-card v-if="tab === 'logs' && logs" shadow="never"
        ><el-table :data="logs.items" row-key="id"
          ><el-table-column label="时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.occurredAtMs)
            }}</template></el-table-column
          ><el-table-column
            prop="action"
            label="动作"
            min-width="160" /><el-table-column
            prop="operator"
            label="操作人" /><el-table-column
            prop="targetUsername"
            label="目标用户" /><el-table-column
            prop="result"
            label="结果" /><el-table-column
            prop="detail"
            label="摘要"
            min-width="220"
            show-overflow-tooltip /><el-table-column
            prop="keyId"
            label="密钥 ID" /><el-table-column
            prop="requestId"
            label="追踪 ID"
            min-width="160"
            show-overflow-tooltip /></el-table
      ></el-card>
      <el-pagination
        v-if="(tab === 'tasks' || tab === 'logs') && (tasks || logs)"
        v-model:current-page="page"
        v-model:page-size="size"
        :total="(tasks ?? logs)?.totalElements ?? 0"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.firing-row) {
  --el-table-tr-bg-color: var(--el-color-danger-light-9);
}
</style>
