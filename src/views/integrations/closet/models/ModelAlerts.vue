<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import {
  getAlerts,
  getAlertSettings,
  saveAlertSettings,
  testAlert,
  time,
  type Alert,
  type AlertSettings
} from "@/api/closet/modelInsights";
import { message } from "@/utils/message";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";

const { can } = useCurrentPermissions();
const writable = computed(() => can("closet:models:write"));
// Independent sections each get their own request helper: a newer request in one section never discards another section's result.
const rowsRequest = useClosetRequest(),
  settingsRequest = useClosetRequest();
const requests = [rowsRequest, settingsRequest];
const loading = computed(() => requests.some(r => r.loading.value));
const unavailable = computed(() => requests.some(r => r.unavailable.value));
const errorMessage = computed(
  () => requests.map(r => r.errorMessage.value).find(Boolean) ?? ""
);
const settings = ref<AlertSettings>();
const rows = ref<Alert[]>([]);
const firing = ref(false);
const names: Record<string, string> = {
  "entry-paused": "模型被暂停",
  "provider-unreachable": "服务商连不上",
  "probe-paid-failed": "付费探活失败",
  "pool-last-member": "池里只剩一家",
  "pool-exhausted": "池里没有可用模型",
  "low-balance": "余额不足",
  "spend-cap": "花费到上限",
  "tryon-vendor-down": "实时试穿供应商全部不可用",
  "tryon-reconcile-gap": "实时试穿对账差额过大",
  "tryon-remote-excess": "实时试穿供应商连接数异常"
};
const mailNames: Record<string, string> = {
  SENT: "已发送",
  THROTTLED: "节流",
  MAIL_DISABLED: "邮件未开启",
  NO_RECIPIENT: "没有收件人",
  FAILED: "发送失败"
};
const loadRows = () =>
  rowsRequest.run(
    () => getAlerts({ state: firing.value ? "FIRING" : "ALL" }),
    result => {
      rows.value = result.data.items;
    }
  );
const load = () => {
  void loadRows();
  void settingsRequest.run(getAlertSettings, result => {
    settings.value = result.data;
  });
};
const save = () => {
  if (!settings.value) return;
  const current = settings.value;
  void settingsRequest.run(
    () =>
      saveAlertSettings({
        rules: Object.fromEntries(
          current.rules.map(rule => [rule.rule, rule.enabled])
        ),
        repeatMinutes: current.repeatMinutes,
        revision: current.revision
      }),
    result => {
      settings.value = result.data;
      message("告警设置已保存", { type: "success" });
    }
  );
};
const sendTest = () =>
  void settingsRequest.run(testAlert, result =>
    message(mailNames[result.data.result] || result.data.result, {
      type: result.data.result === "SENT" ? "success" : "warning"
    })
  );
onMounted(load);
</script>

<template>
  <div class="page-root space-y-4">
    <p class="text-xs text-gray-500">
      上游被暂停、探活连不上、池里只剩一家或全挂、余额不足、花费到上限、实时试穿供应商全挂或对账差额过大时发邮件；同一件事
      60 分钟内最多提醒一次。邮件模块关闭时只在这里记录。
    </p>
    <ClosetUnavailable v-if="unavailable" /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-card v-if="settings">
      <template #header
        ><div class="flex justify-between">
          <div>
            <h2 class="text-base">邮件状态</h2>
            <p class="text-xs text-gray-500">
              收件人由部署配置设置，这里只显示配置状态。
            </p>
          </div>
          <el-button v-if="writable" :loading="loading" @click="sendTest"
            >发一封测试邮件</el-button
          >
        </div></template
      >
      邮件模块：{{ settings.mailEnabled ? "已开启" : "未开启" }}；收件人：{{
        settings.recipientsConfigured ? "已配置" : "未配置"
      }}
    </el-card>
    <el-card>
      <template #header
        ><div>
          <h2 class="text-base">告警记录</h2>
          <p class="text-xs text-gray-500">
            查看触发与恢复记录；还没有告警时这里为空。
          </p>
        </div></template
      >
      <el-checkbox v-model="firing" @change="loadRows">只看未恢复</el-checkbox>
      <el-table :data="rows" empty-text="还没有告警记录"
        ><el-table-column label="时间" min-width="170"
          ><template #default="{ row }">{{
            time(row.atMs)
          }}</template></el-table-column
        ><el-table-column label="规则" min-width="180"
          ><template #default="{ row }">{{
            names[row.rule] || row.ruleName
          }}</template></el-table-column
        ><el-table-column prop="refId" label="对象" /><el-table-column
          label="状态"
          ><template #default="{ row }">{{
            row.state === "FIRING" ? "触发" : "恢复"
          }}</template></el-table-column
        ><el-table-column prop="reading" label="读数" /><el-table-column
          label="邮件结果"
          ><template #default="{ row }">{{
            mailNames[row.mailResult] || "—"
          }}</template></el-table-column
        ></el-table
      >
    </el-card>
    <el-card v-if="settings"
      ><template #header
        ><div class="flex justify-between">
          <div>
            <h2 class="text-base">规则设置</h2>
            <p class="text-xs text-gray-500">
              设置每条规则和重复提醒间隔；未配置时规则默认开启。
            </p>
          </div>
          <el-button
            v-if="writable"
            type="primary"
            :loading="loading"
            @click="save"
            >保存</el-button
          >
        </div></template
      >
      <el-form label-width="150px"
        ><el-form-item label="重复提醒间隔"
          ><el-input-number
            v-model="settings.repeatMinutes"
            :min="5"
            :max="1440"
            :disabled="!writable"
          />
          分钟</el-form-item
        ><el-form-item
          v-for="rule in settings.rules"
          :key="rule.rule"
          :label="names[rule.rule] || rule.name"
          ><el-switch v-model="rule.enabled" :disabled="!writable" />
          <p class="text-xs text-gray-500">{{ rule.trigger }}</p></el-form-item
        ></el-form
      >
    </el-card>
  </div>
</template>
