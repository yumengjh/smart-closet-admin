<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import {
  getBatches,
  postBatch,
  getCodes,
  disableBatch,
  type Batch,
  type BatchInput,
  type Code
} from "@/api/closet/billing";
import { message } from "@/utils/message";
import { formatTime } from "../useClosetRequest";
import BillingFrame from "./BillingFrame.vue";
import { integer, money, useBilling } from "./useBilling";
defineOptions({ name: "ClosetBillingRedemptions" });
const { can, loading, saving, error, load, write } = useBilling();
const batches = ref<Batch[]>([]);
const codes = ref<Code[]>([]);
const clearCodes = ref<string[]>([]);
const createDialog = ref(false);
const codesDialog = ref(false);
const selectedName = ref("");
const withEntitlement = ref(false);
const form = reactive<BatchInput>({
  name: "",
  points: 0,
  quantity: 1,
  unitPriceMicro: 0,
  currency: "CNY",
  imageDailyLimit: 0,
  agentDailyLimit: 0,
  entitlementDays: 30
});
const valid = computed(
  () =>
    form.name.trim() &&
    integer(form.points, 0, 10000000) &&
    integer(form.quantity, 1, 500) &&
    integer(form.unitPriceMicro) &&
    (!form.unitPriceMicro || form.currency?.trim()) &&
    (!withEntitlement.value ||
      (integer(form.entitlementDays, 1, 3650) &&
        integer(form.imageDailyLimit, 0, 1000) &&
        integer(form.agentDailyLimit, 0, 1000))) &&
    (form.points > 0 || withEntitlement.value) &&
    (!form.validFromMs ||
      !form.validUntilMs ||
      Number(form.validUntilMs) > Number(form.validFromMs))
);
const refresh = () =>
  load(getBatches, r => {
    batches.value = r.data;
  });
function create() {
  if (!valid.value || clearCodes.value.length) return;
  const data: BatchInput = {
    name: form.name.trim(),
    points: form.points,
    quantity: form.quantity,
    unitPriceMicro: form.unitPriceMicro,
    currency: form.currency?.trim() || undefined,
    validFromMs: form.validFromMs ? Number(form.validFromMs) : undefined,
    validUntilMs: form.validUntilMs ? Number(form.validUntilMs) : undefined,
    ...(withEntitlement.value
      ? {
          imageDailyLimit: form.imageDailyLimit,
          agentDailyLimit: form.agentDailyLimit,
          entitlementDays: form.entitlementDays
        }
      : {})
  };
  void write(
    "创建兑换码批次",
    () => postBatch(data),
    r => {
      clearCodes.value = r.data.codes;
      createDialog.value = false;
      void refresh();
    }
  );
}
function view(batch: Batch) {
  codes.value = [];
  selectedName.value = batch.name;
  codesDialog.value = true;
  void load(
    () => getCodes(batch.id),
    r => {
      codes.value = r.data;
    }
  );
}
const disable = (batch: Batch) =>
  write(
    "停用批次",
    () => disableBatch(batch.id),
    () => void refresh(),
    `确认停用批次“${batch.name}”内所有未兑换的码？`
  );
async function copy() {
  try {
    await navigator.clipboard.writeText(clearCodes.value.join("\n"));
    message("已复制全部兑换码", { type: "success" });
  } catch {
    message("复制失败，请手动选择并复制全部兑换码", { type: "warning" });
  }
}
function saved() {
  clearCodes.value = [];
}
onBeforeRouteLeave(() => {
  if (saving.value || clearCodes.value.length) {
    message("请等待创建完成并确认已保存兑换码", { type: "warning" });
    return false;
  }
});
onMounted(() => {
  if (can("closet:billing:read")) void refresh();
});
</script>
<template>
  <BillingFrame
    title="兑换码批次"
    :error="error"
    :loading="loading"
    :saving="saving"
    @refresh="refresh"
  >
    <el-card shadow="never">
      <el-button
        v-if="can('closet:billing:write')"
        type="primary"
        class="mb-4"
        :disabled="saving || !!clearCodes.length"
        @click="createDialog = true"
        >创建批次</el-button
      >
      <el-table :data="batches" stripe
        ><el-table-column
          prop="batchNo"
          label="批次号"
          min-width="180"
        /><el-table-column
          prop="name"
          label="名称"
          min-width="150"
        /><el-table-column
          prop="status"
          label="状态"
          width="120"
        /><el-table-column
          prop="points"
          label="每码点数"
          width="110"
        /><el-table-column
          prop="currency"
          label="币种"
          width="90"
        /><el-table-column label="每点售价（元）" min-width="140"
          ><template #default="{ row }">{{
            money(row.unitPriceMicro, 1000000)
          }}</template></el-table-column
        ><el-table-column
          prop="entitlementDays"
          label="权益天数"
          width="100"
        /><el-table-column
          prop="quantity"
          label="总数"
          width="80"
        /><el-table-column
          prop="available"
          label="可兑换"
          width="90"
        /><el-table-column
          prop="redeemed"
          label="已兑换"
          width="90"
        /><el-table-column label="有效期" min-width="300"
          ><template #default="{ row }"
            >{{ formatTime(row.validFromMs) }} 至
            {{ formatTime(row.validUntilMs) }}</template
          ></el-table-column
        ><el-table-column label="操作" width="170"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :disabled="saving"
              @click="view(row)"
              >查看码状态</el-button
            ><el-button
              v-if="can('closet:billing:write')"
              link
              type="danger"
              :disabled="saving || row.status === 'DISABLED'"
              @click="disable(row)"
              >停用</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </el-card>
    <el-dialog
      v-model="createDialog"
      title="创建兑换码批次"
      width="min(620px, 94vw)"
      :close-on-click-modal="false"
      :before-close="
        done => {
          if (!saving) done();
        }
      "
    >
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="批次名称"
          ><el-input v-model="form.name" maxlength="120"
        /></el-form-item>
        <el-form-item label="每码点数"
          ><el-input-number
            v-model="form.points"
            :min="0"
            :max="10000000"
            :precision="0"
        /></el-form-item>
        <el-form-item label="生成数量"
          ><el-input-number
            v-model="form.quantity"
            :min="1"
            :max="500"
            :precision="0"
        /></el-form-item>
        <el-form-item label="每点售价（币种百万分之一，0 为赠送）"
          ><el-input-number
            v-model="form.unitPriceMicro"
            :min="0"
            :max="Number.MAX_SAFE_INTEGER"
            :precision="0"
        /></el-form-item>
        <el-form-item label="币种"
          ><el-input v-model="form.currency" maxlength="8"
        /></el-form-item>
        <el-form-item label="包含权益"
          ><el-switch v-model="withEntitlement"
        /></el-form-item>
        <template v-if="withEntitlement"
          ><el-form-item label="权益天数"
            ><el-input-number
              v-model="form.entitlementDays"
              :min="1"
              :max="3650"
              :precision="0" /></el-form-item
          ><el-form-item label="图片日额度"
            ><el-input-number
              v-model="form.imageDailyLimit"
              :min="0"
              :max="1000"
              :precision="0" /></el-form-item
          ><el-form-item label="助手日额度"
            ><el-input-number
              v-model="form.agentDailyLimit"
              :min="0"
              :max="1000"
              :precision="0" /></el-form-item
        ></template>
        <el-form-item label="生效时间（留空不限制）"
          ><el-date-picker
            v-model="form.validFromMs"
            type="datetime"
            value-format="x" /></el-form-item
        ><el-form-item label="到期时间（留空不限制）"
          ><el-date-picker
            v-model="form.validUntilMs"
            type="datetime"
            value-format="x"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button :disabled="saving" @click="createDialog = false"
          >取消</el-button
        ><el-button
          type="primary"
          :disabled="!valid"
          :loading="saving"
          @click="create"
          >创建</el-button
        ></template
      >
    </el-dialog>
    <el-dialog
      :model-value="!!clearCodes.length"
      title="兑换码仅显示一次"
      width="min(620px, 94vw)"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <el-alert
        title="请立即复制并妥善保存。点击“我已保存”后明文将清除，刷新页面也会丢失。"
        type="warning"
        :closable="false"
        class="mb-4"
      />
      <el-input
        :model-value="clearCodes.join('\n')"
        type="textarea"
        :rows="12"
        readonly
        aria-label="本次生成的明文兑换码"
      />
      <template #footer
        ><el-button @click="copy">复制全部</el-button
        ><el-button type="primary" @click="saved">我已保存</el-button></template
      >
    </el-dialog>
    <el-dialog
      v-model="codesDialog"
      :title="`${selectedName} · 码状态`"
      width="min(850px, 94vw)"
    >
      <el-table v-loading="loading" :data="codes"
        ><el-table-column
          prop="mask"
          label="遮罩码"
          min-width="150"
        /><el-table-column
          prop="status"
          label="状态"
          min-width="120"
        /><el-table-column
          prop="redeemedByUserKey"
          label="userKey"
          min-width="200"
        /><el-table-column label="兑换时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.redeemedAtMs)
          }}</template></el-table-column
        ></el-table
      >
    </el-dialog>
  </BillingFrame>
</template>
