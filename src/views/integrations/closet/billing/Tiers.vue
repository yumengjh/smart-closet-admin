<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  getTiers,
  putTier,
  getCosts,
  postCost,
  type Tier,
  type CostRate,
  type CostInput
} from "@/api/closet/billing";
import { formatTime } from "../useClosetRequest";
import BillingFrame from "./BillingFrame.vue";
import { integer, money, useBilling } from "./useBilling";
defineOptions({ name: "ClosetBillingTiers" });
const { can, loading, saving, error, load, write } = useBilling();
const tiers = ref<Tier[]>([]);
const costs = ref<CostRate[]>([]);
const tierDialog = ref(false);
const costDialog = ref(false);
const selected = ref("");
const tierForm = reactive({
  model: "",
  milliPointsPerUnit: undefined as number | undefined,
  effectiveFromMs: undefined as number | undefined
});
const cost = reactive<CostInput>({
  model: "",
  unit: "PER_IMAGE",
  amountMicro: 0,
  currency: "CNY",
  note: ""
});
const validTier = computed(
  () =>
    (tierForm.model.trim() || tierForm.milliPointsPerUnit != null) &&
    (tierForm.milliPointsPerUnit == null ||
      integer(tierForm.milliPointsPerUnit, 0, 1000000000))
);
const validCost = computed(
  () =>
    cost.model.trim() &&
    cost.currency.trim() &&
    integer(cost.amountMicro, 0, 1000000000000)
);
const refresh = () =>
  load(
    () => Promise.all([getTiers(), getCosts()]),
    ([t, c]) => {
      tiers.value = t.data;
      costs.value = c.data;
    }
  );
function edit(tier: Tier) {
  selected.value = tier.tier;
  Object.assign(tierForm, {
    model: tier.model,
    milliPointsPerUnit: tier.milliPointsPerUnit ?? undefined,
    effectiveFromMs: undefined
  });
  tierDialog.value = true;
}
const saveTier = () => {
  if (!validTier.value) return;
  const data = {
    model: tierForm.model.trim() || undefined,
    milliPointsPerUnit: tierForm.milliPointsPerUnit,
    effectiveFromMs: tierForm.effectiveFromMs
      ? Number(tierForm.effectiveFromMs)
      : undefined
  };
  void write(
    "追加档位版本",
    () => putTier(selected.value, data),
    () => {
      tierDialog.value = false;
      void refresh();
    }
  );
};
const saveCost = () => {
  if (!validCost.value) return;
  const data = {
    ...cost,
    model: cost.model.trim(),
    currency: cost.currency.trim(),
    effectiveFromMs: cost.effectiveFromMs
      ? Number(cost.effectiveFromMs)
      : undefined
  };
  void write(
    "追加成本版本",
    () => postCost(data),
    () => {
      costDialog.value = false;
      void refresh();
    }
  );
};
onMounted(() => {
  if (can("closet:billing:read")) void refresh();
});
</script>
<template>
  <BillingFrame
    title="档位与成本"
    :error="error"
    :loading="loading"
    :saving="saving"
    @refresh="refresh"
  >
    <el-card shadow="never">
      <h3 class="mb-3 font-semibold">当前档位</h3>
      <el-alert
        title="档位接口仅提供当前模型、点数价格和价格版本号。完整模型与价格历史需服务端提供查询接口。"
        type="info"
        :closable="false"
        class="mb-3"
      />
      <el-table :data="tiers" stripe>
        <el-table-column
          prop="tier"
          label="档位"
          min-width="160"
        /><el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column
          prop="model"
          label="模型"
          min-width="180"
        /><el-table-column prop="unit" label="计费单位" min-width="100" />
        <el-table-column
          prop="milliPointsPerUnit"
          label="千分点 / 单位"
          min-width="140"
        /><el-table-column
          prop="priceVersionId"
          label="价格版本号"
          min-width="260"
        />
        <el-table-column
          v-if="can('closet:billing:write')"
          label="操作"
          width="130"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :disabled="saving"
              @click="edit(row)"
              >追加版本</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-card>
    <el-card shadow="never">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">成本历史版本</h3>
        <el-button
          v-if="can('closet:billing:write')"
          :disabled="saving"
          @click="costDialog = true"
          >追加成本</el-button
        >
      </div>
      <el-table :data="costs" stripe
        ><el-table-column
          prop="id"
          label="版本号"
          min-width="260" /><el-table-column
          prop="model"
          label="模型"
          min-width="180" /><el-table-column
          prop="unit"
          label="单位"
          min-width="150" /><el-table-column
          prop="currency"
          label="币种"
          width="90" /><el-table-column
          label="成本（元 / 单位）"
          min-width="160"
          ><template #default="{ row }">{{
            money(row.amountMicro, 1000000)
          }}</template></el-table-column
        ><el-table-column label="生效时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.effectiveFromMs)
          }}</template></el-table-column
        ><el-table-column prop="note" label="备注" min-width="180"
      /></el-table>
    </el-card>
    <el-dialog
      v-model="tierDialog"
      title="追加档位版本"
      width="min(560px, 94vw)"
      :close-on-click-modal="false"
      :before-close="
        done => {
          if (!saving) done();
        }
      "
    >
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="档位"
          ><el-input :model-value="selected" disabled
        /></el-form-item>
        <el-form-item label="模型（留空保留现有模型）"
          ><el-input v-model="tierForm.model" maxlength="80"
        /></el-form-item>
        <el-form-item label="点数价格（千分点 / 单位，留空保留）"
          ><el-input-number
            v-model="tierForm.milliPointsPerUnit"
            :min="0"
            :max="1000000000"
            :precision="0"
        /></el-form-item>
        <el-form-item label="生效时间（留空立即生效）"
          ><el-date-picker
            v-model="tierForm.effectiveFromMs"
            type="datetime"
            value-format="x"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button :disabled="saving" @click="tierDialog = false"
          >取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!validTier"
          @click="saveTier"
          >追加版本</el-button
        ></template
      >
    </el-dialog>
    <el-dialog
      v-model="costDialog"
      title="追加成本版本"
      width="min(560px, 94vw)"
      :close-on-click-modal="false"
      :before-close="
        done => {
          if (!saving) done();
        }
      "
    >
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="模型"
          ><el-input v-model="cost.model" maxlength="80"
        /></el-form-item>
        <el-form-item label="成本单位"
          ><el-select v-model="cost.unit"
            ><el-option
              v-for="unit in [
                'PER_IMAGE',
                'PER_MTOK_IN',
                'PER_MTOK_OUT',
                'PER_SECOND'
              ]"
              :key="unit"
              :value="unit"
              :label="unit" /></el-select
        ></el-form-item>
        <el-form-item label="金额（币种百万分之一）"
          ><el-input-number
            v-model="cost.amountMicro"
            :min="0"
            :max="1000000000000"
            :precision="0"
        /></el-form-item>
        <el-form-item label="币种"
          ><el-input v-model="cost.currency" maxlength="8"
        /></el-form-item>
        <el-form-item label="生效时间（留空立即生效）"
          ><el-date-picker
            v-model="cost.effectiveFromMs"
            type="datetime"
            value-format="x"
        /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="cost.note" type="textarea" maxlength="200"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button :disabled="saving" @click="costDialog = false"
          >取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!validCost"
          @click="saveCost"
          >追加版本</el-button
        ></template
      >
    </el-dialog>
  </BillingFrame>
</template>
