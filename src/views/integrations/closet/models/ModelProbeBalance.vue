<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import {
  getProbe,
  saveProbe,
  freeProbe,
  getBalances,
  saveBilling,
  refreshBalance,
  manualBalance,
  balanceHistory,
  money,
  time,
  type Probe,
  type Balance,
  type Snapshot
} from "@/api/closet/modelInsights";
import { message } from "@/utils/message";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";

const { can } = useCurrentPermissions();
const writable = computed(() => can("closet:models:write"));
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const probe = ref<Probe>();
const balances = ref<Balance[]>([]);
const billingOpen = ref(false);
const manualOpen = ref(false);
const historyOpen = ref(false);
const selected = ref<Balance>();
const history = ref<Snapshot[]>([]);
const form = ref({
  source: "NONE",
  token: "",
  unit: "USD",
  quotaPerUnit: 500000,
  lowBalance: null as number | null,
  currency: "CNY",
  autoRemove: false,
  revision: null as number | null
});
const manual = ref({
  balance: 0,
  currency: "CNY",
  atMs: null as number | null
});
const caps: Record<string, string> = {
  VISION: "识图",
  CHAT: "对话",
  IMAGE: "生图"
};
const loadProbe = () =>
  void run(getProbe, result => {
    probe.value = result.data;
  });
const loadBalances = () =>
  void run(getBalances, result => {
    balances.value = result.data.providers;
  });
const load = () => {
  loadProbe();
  loadBalances();
};
const saveSettings = () => {
  if (!probe.value) return;
  const current = probe.value;
  void run(
    () => saveProbe({ ...current.settings, revision: current.revision }),
    result => {
      probe.value = result.data;
      message("探活设置已保存", { type: "success" });
    }
  );
};
const doProbe = (id: string) =>
  void run(
    () => freeProbe(id),
    () => {
      message("免费探活完成", { type: "success" });
      load();
    }
  );
const editBilling = (row: Balance) => {
  selected.value = row;
  const b = row.billing;
  form.value = {
    source: b.source,
    token: "",
    unit: b.unit || "USD",
    quotaPerUnit: b.quotaPerUnit || 500000,
    lowBalance: b.lowBalanceMicro == null ? null : b.lowBalanceMicro / 1000000,
    currency: b.currency || "CNY",
    autoRemove: b.autoRemove,
    revision: b.revision
  };
  billingOpen.value = true;
};
const saveSource = () => {
  if (!selected.value) return;
  const f = form.value;
  const data = {
    source: f.source,
    ...(f.token ? { token: f.token } : {}),
    ...(f.source === "NEWAPI"
      ? {
          unit: f.unit,
          quotaPerUnit: f.unit === "QUOTA" ? f.quotaPerUnit : null
        }
      : {}),
    lowBalanceMicro:
      f.lowBalance == null ? null : Math.round(f.lowBalance * 1000000),
    currency: f.currency,
    autoRemove: f.autoRemove,
    ...(f.revision == null ? {} : { revision: f.revision })
  };
  void run(
    () => saveBilling(selected.value!.providerId, data),
    result => {
      selected.value = result.data;
      billingOpen.value = false;
      message("余额来源已保存，请核对上游原始数字与换算结果", {
        type: "success"
      });
      loadBalances();
    }
  );
};
const refresh = (row: Balance) =>
  void run(
    () => refreshBalance(row.providerId),
    result => {
      if (result.data.lastError)
        message(result.data.lastError, { type: "warning" });
      loadBalances();
    }
  );
const openManual = (row: Balance) => {
  selected.value = row;
  manual.value = {
    balance: 0,
    currency: row.billing.currency || "CNY",
    atMs: null
  };
  manualOpen.value = true;
};
const saveManual = () => {
  if (!selected.value) return;
  void run(
    () =>
      manualBalance(selected.value!.providerId, {
        balanceMicro: Math.round(manual.value.balance * 1000000),
        currency: manual.value.currency,
        ...(manual.value.atMs == null ? {} : { atMs: manual.value.atMs })
      }),
    () => {
      manualOpen.value = false;
      loadBalances();
    }
  );
};
const openHistory = (row: Balance) => {
  selected.value = row;
  history.value = [];
  historyOpen.value = true;
  void run(
    () => balanceHistory(row.providerId),
    result => {
      history.value = result.data.items;
    }
  );
};
const freeStatus = (id: string) =>
  probe.value?.free.find(item => item.providerId === id);
onMounted(load);
</script>
<template>
  <div class="page-root space-y-4">
    <p class="text-xs text-gray-500">
      免费探活只调列模型和查余额接口，证明网络和密钥正常，但不能证明能出图；付费探活会发最小的真实请求，有每日次数和花费上限。
    </p>
    <ClosetUnavailable v-if="unavailable" /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-card v-if="probe"
      ><template #header
        ><div class="flex justify-between">
          <div>
            <h2 class="text-base">探活设置</h2>
            <p class="text-xs text-gray-500">
              设置免费与定时付费探活；付费探活未开启时不会定时发出真实请求。
            </p>
          </div>
          <el-button
            v-if="writable"
            type="primary"
            :loading="loading"
            @click="saveSettings"
            >保存</el-button
          >
        </div></template
      >
      <el-form label-width="190px"
        ><el-form-item label="免费探活"
          ><el-switch
            v-model="probe.settings.freeEnabled"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="免费间隔（分钟）"
          ><el-input-number
            v-model="probe.settings.freeIntervalMinutes"
            :min="1"
            :max="1440"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="连续失败几次算连不上"
          ><el-input-number
            v-model="probe.settings.freeFailures"
            :min="1"
            :max="10"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="付费探活"
          ><el-switch
            v-model="probe.settings.paidEnabled"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="全站每日次数"
          ><el-input-number
            v-model="probe.settings.paidDailyCalls"
            :min="0"
            :max="1000"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="每个模型每日次数"
          ><el-input-number
            v-model="probe.settings.paidPerEntry"
            :min="0"
            :max="100"
            :disabled="!writable" /></el-form-item
        ><el-form-item
          v-for="(name, key) in caps"
          :key="key"
          :label="`${name}每日花费上限（人民币微元）`"
          ><el-input-number
            v-model="probe.settings.paidSpendCapMicro[key]"
            :min="0"
            :max="1000000000"
            :disabled="!writable" /></el-form-item
        ><el-form-item label="美元折算人民币汇率"
          ><el-input-number
            v-model="probe.settings.usdToCny"
            :min="0.0001"
            :max="100"
            :precision="4"
            :disabled="!writable" /></el-form-item
      ></el-form>
      <p>
        今日付费探活：{{ probe.paidUsage.calls }} 次，花费
        {{
          money(
            Object.values(probe.paidUsage.spendMicro).reduce(
              (a, b) => a + b,
              0
            ),
            "CNY"
          )
        }}（<span v-for="(name, key) in caps" :key="key"
          >{{ name }}
          {{ money(probe.paidUsage.spendMicro[key] || 0, "CNY") }} </span
        >）
      </p>
    </el-card>
    <el-card
      ><template #header
        ><div>
          <h2 class="text-base">服务商探活状态</h2>
          <p class="text-xs text-gray-500">
            免费探活记录在服务重启后重新积累；未探活的服务商显示暂无记录。
          </p>
        </div></template
      ><el-table :data="balances" empty-text="还没有服务商，配置后可免费探活"
        ><el-table-column prop="providerName" label="服务商" /><el-table-column
          label="最近免费探活"
          ><template #default="{ row }">{{
            time(freeStatus(row.providerId)?.atMs)
          }}</template></el-table-column
        ><el-table-column label="结果"
          ><template #default="{ row }">{{
            freeStatus(row.providerId)
              ? freeStatus(row.providerId)?.ok
                ? "成功"
                : `失败 ${freeStatus(row.providerId)?.code || ""}`
              : "暂无记录"
          }}</template></el-table-column
        ><el-table-column label="耗时"
          ><template #default="{ row }">{{
            freeStatus(row.providerId)
              ? `${freeStatus(row.providerId)?.latencyMs} ms`
              : "—"
          }}</template></el-table-column
        ><el-table-column label="连不上"
          ><template #default="{ row }">{{
            freeStatus(row.providerId)?.unreachable ? "是" : "否"
          }}</template></el-table-column
        ><el-table-column v-if="writable" label="操作"
          ><template #default="{ row }"
            ><el-button link @click="doProbe(row.providerId)"
              >立即探活（免费）</el-button
            ></template
          ></el-table-column
        ></el-table
      ></el-card
    >
    <el-card
      ><template #header
        ><div>
          <h2 class="text-base">余额</h2>
          <p class="text-xs text-gray-500">
            能自动查余额的平台（NewAPI / OneAPI
            类中转、OpenRouter）随探活刷新；其他平台手动录入某时刻的余额，系统用调用账本估算之后的花费。
          </p>
        </div></template
      >
      <el-table
        :data="balances"
        empty-text="还没有服务商；未设置余额来源时不自动查询"
        ><el-table-column prop="providerName" label="服务商" /><el-table-column
          prop="billing.source"
          label="来源"
        /><el-table-column label="上游余额 / 时间" min-width="200"
          ><template #default="{ row }"
            ><template v-if="row.reported"
              >{{
                money(
                  row.reported.converted.balanceMicro,
                  row.reported.converted.currency
                )
              }}<br />{{ time(row.reported.atMs) }}<br />原始：{{
                JSON.stringify(row.reported.raw.json)
              }}
              {{ row.reported.raw.unit }}</template
            ><template v-else>暂无读数</template></template
          ></el-table-column
        ><el-table-column label="本地估算"
          ><template #default="{ row }">{{
            money(
              row.estimatedMicro,
              row.reported?.converted.currency || row.billing.currency
            )
          }}</template></el-table-column
        ><el-table-column label="差额"
          ><template #default="{ row }"
            ><el-tooltip
              content="成本价可能没录准，或上游有其他消耗"
              :disabled="!row.differenceWarning"
              ><span
                :style="{
                  color: row.differenceWarning ? 'var(--el-color-warning)' : ''
                }"
                >{{
                  money(
                    row.differenceMicro,
                    row.reported?.converted.currency || row.billing.currency
                  )
                }}</span
              ></el-tooltip
            ></template
          ></el-table-column
        ><el-table-column label="阈值"
          ><template #default="{ row }">{{
            money(row.billing.lowBalanceMicro, row.billing.currency)
          }}</template></el-table-column
        ><el-table-column label="自动移出"
          ><template #default="{ row }">{{
            row.billing.autoRemove ? (row.removed ? "已移出" : "开启") : "关闭"
          }}</template></el-table-column
        ><el-table-column label="操作" min-width="230"
          ><template #default="{ row }"
            ><el-button v-if="writable" link @click="editBilling(row)"
              >设置来源</el-button
            ><el-button v-if="writable" link @click="refresh(row)"
              >立即刷新</el-button
            ><el-button v-if="writable" link @click="openManual(row)"
              >手动录入</el-button
            ><el-button link @click="openHistory(row)"
              >历史</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </el-card>
    <el-dialog v-model="billingOpen" title="设置余额来源" width="560px"
      ><el-form label-width="140px"
        ><el-form-item label="来源"
          ><el-select v-model="form.source"
            ><el-option label="未配置" value="NONE" /><el-option
              label="NewAPI / OneAPI"
              value="NEWAPI" /><el-option
              label="OpenRouter"
              value="OPENROUTER" /><el-option
              label="手动"
              value="MANUAL" /></el-select></el-form-item
        ><template v-if="form.source === 'NEWAPI'"
          ><el-form-item label="上游单位"
            ><el-select v-model="form.unit"
              ><el-option label="USD" value="USD" /><el-option
                label="CNY"
                value="CNY" /><el-option
                label="原始额度"
                value="QUOTA" /></el-select></el-form-item
          ><el-form-item v-if="form.unit === 'QUOTA'" label="每单位额度"
            ><el-input-number
              v-model="form.quotaPerUnit"
              :min="1"
              :max="1000000000" /></el-form-item></template
        ><el-form-item
          v-if="form.source === 'NEWAPI' || form.source === 'OPENROUTER'"
          label="访问令牌"
          ><el-input
            v-model="form.token"
            type="password"
            show-password
            placeholder="留空保持现有令牌；OpenRouter 可选填管理密钥" /></el-form-item
        ><el-form-item label="低余额阈值"
          ><el-input-number v-model="form.lowBalance" :min="0" :precision="4" />
          <el-input v-model="form.currency" style="width: 90px" /></el-form-item
        ><el-form-item label="余额不足自动移出"
          ><el-switch v-model="form.autoRemove" /></el-form-item
      ></el-form>
      <p class="text-xs text-gray-500">
        首次保存后请核对表格中上游原始数字与换算结果。
      </p>
      <template #footer
        ><el-button @click="billingOpen = false">取消</el-button
        ><el-button type="primary" @click="saveSource"
          >保存</el-button
        ></template
      ></el-dialog
    >
    <el-dialog v-model="manualOpen" title="手动录入余额" width="500px"
      ><el-form label-width="100px"
        ><el-form-item label="余额"
          ><el-input-number v-model="manual.balance" :precision="4" />
          <el-input
            v-model="manual.currency"
            style="width: 90px" /></el-form-item
        ><el-form-item label="读数时间"
          ><el-date-picker
            v-model="manual.atMs"
            type="datetime"
            value-format="x"
            placeholder="留空为现在" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="manualOpen = false">取消</el-button
        ><el-button type="primary" @click="saveManual"
          >保存</el-button
        ></template
      ></el-dialog
    >
    <el-drawer v-model="historyOpen" title="余额历史" size="60%"
      ><el-table :data="history" empty-text="还没有余额读数"
        ><el-table-column label="时间" min-width="170"
          ><template #default="{ row }">{{
            time(row.atMs)
          }}</template></el-table-column
        ><el-table-column prop="source" label="来源" /><el-table-column
          label="上游原始数字"
          ><template #default="{ row }"
            >{{ JSON.stringify(row.raw.json) }} {{ row.raw.unit }}</template
          ></el-table-column
        ><el-table-column label="换算结果"
          ><template #default="{ row }">{{
            money(row.converted.balanceMicro, row.converted.currency)
          }}</template></el-table-column
        ></el-table
      ></el-drawer
    >
  </div>
</template>
