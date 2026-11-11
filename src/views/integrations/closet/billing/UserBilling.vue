<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
  getUserBilling,
  changePoints,
  grantEntitlement,
  revokeEntitlement,
  type UserBilling,
  type Entitlement
} from "@/api/closet/billing";
import { formatTime } from "../useClosetRequest";
import { integer, useBilling } from "./useBilling";
const props = defineProps<{ username: string }>();
const { can, loading, saving, error, load, write } = useBilling();
const wallet = ref<UserBilling>();
const points = reactive({ points: 100, note: "" });
const entitlement = reactive({
  imageDailyLimit: 40,
  agentDailyLimit: 40,
  days: 30,
  note: ""
});
let attempt: { fingerprint: string; key: string } | undefined;
const refresh = () =>
  load(
    () => getUserBilling(props.username),
    result => {
      wallet.value = result.data;
    }
  );
function adjust() {
  if (!integer(points.points, -10000000, 10000000) || !points.points) return;
  const data = { points: points.points, note: points.note.trim() };
  const fingerprint = JSON.stringify(data);
  if (!attempt || attempt.fingerprint !== fingerprint)
    attempt = { fingerprint, key: crypto.randomUUID() };
  const key = attempt.key;
  void write(
    "调整点数",
    () => changePoints(props.username, data, key),
    () => {
      attempt = undefined;
      void refresh();
    },
    `确认为 ${props.username} ${data.points > 0 ? "发放" : "扣回"} ${Math.abs(data.points)} 点？`
  );
}
function grant() {
  if (
    !integer(entitlement.days, 1, 3650) ||
    !integer(entitlement.imageDailyLimit, 0, 1000) ||
    !integer(entitlement.agentDailyLimit, 0, 1000)
  )
    return;
  void write(
    "发放权益",
    () => grantEntitlement(props.username, { ...entitlement }),
    () => void refresh(),
    `确认为 ${props.username} 发放 ${entitlement.days} 天权益？`
  );
}
function revoke(item: Entitlement) {
  void write(
    "撤销权益",
    () => revokeEntitlement(item.id),
    () => void refresh(),
    "确认撤销这项权益？已保存的数据会保留。"
  );
}
onMounted(() => {
  if (can("closet:billing:read")) void refresh();
});
</script>
<template>
  <div v-loading="loading" class="space-y-4">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="flex items-center justify-between">
      <h3>点数与权益</h3>
      <el-button :disabled="saving" @click="refresh">刷新</el-button>
    </div>
    <template v-if="wallet">
      <el-descriptions :column="2" border
        ><el-descriptions-item label="余额"
          >{{ wallet.balance }} 点</el-descriptions-item
        ><el-descriptions-item label="预留中"
          >{{ wallet.reserved }} 点</el-descriptions-item
        ></el-descriptions
      >
      <el-card v-if="can('closet:billing:write')" shadow="never">
        <h4 class="mb-3">调整点数</h4>
        <el-form label-position="top" :disabled="saving">
          <el-form-item label="点数（正数发放，负数扣回）"
            ><el-input-number
              v-model="points.points"
              :min="-10000000"
              :max="10000000"
              :precision="0"
          /></el-form-item>
          <el-form-item label="备注"
            ><el-input v-model="points.note" maxlength="200"
          /></el-form-item>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!points.points"
            @click="adjust"
            >确认调整</el-button
          >
        </el-form>
      </el-card>
      <el-card v-if="can('closet:billing:write')" shadow="never">
        <h4 class="mb-3">发放限时权益</h4>
        <el-form label-position="top" :disabled="saving">
          <el-form-item label="图片每日额度"
            ><el-input-number
              v-model="entitlement.imageDailyLimit"
              :min="0"
              :max="1000"
              :precision="0"
          /></el-form-item>
          <el-form-item label="助手每日额度"
            ><el-input-number
              v-model="entitlement.agentDailyLimit"
              :min="0"
              :max="1000"
              :precision="0"
          /></el-form-item>
          <el-form-item label="有效天数"
            ><el-input-number
              v-model="entitlement.days"
              :min="1"
              :max="3650"
              :precision="0"
          /></el-form-item>
          <el-form-item label="备注"
            ><el-input v-model="entitlement.note" maxlength="80"
          /></el-form-item>
          <el-button type="primary" :loading="saving" @click="grant"
            >发放权益</el-button
          >
        </el-form>
      </el-card>
      <h4>权益记录</h4>
      <el-table :data="wallet.entitlements" stripe>
        <el-table-column prop="source" label="来源" /><el-table-column
          prop="imageDailyLimit"
          label="图片日额度"
        /><el-table-column prop="agentDailyLimit" label="助手日额度" />
        <el-table-column label="到期时间" min-width="170"
          ><template #default="{ row }">{{
            formatTime(row.endsAtMs)
          }}</template></el-table-column
        >
        <el-table-column label="状态"
          ><template #default="{ row }">{{
            row.active ? "生效中" : "已失效"
          }}</template></el-table-column
        >
        <el-table-column v-if="can('closet:billing:write')" label="操作"
          ><template #default="{ row }"
            ><el-button
              v-if="row.active"
              link
              type="danger"
              :disabled="saving"
              @click="revoke(row)"
              >撤销</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <h4>最近流水</h4>
      <el-table :data="wallet.recent" stripe
        ><el-table-column prop="kind" label="类型" /><el-table-column
          prop="points"
          label="点数"
        /><el-table-column prop="note" label="备注" /><el-table-column
          label="时间"
          min-width="170"
          ><template #default="{ row }">{{
            formatTime(row.createdAtMs)
          }}</template></el-table-column
        ></el-table
      >
    </template>
  </div>
</template>
