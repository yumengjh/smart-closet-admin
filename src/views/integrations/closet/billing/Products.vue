<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  getProducts,
  postProduct,
  putProduct,
  getOrders,
  disputeOrder,
  type Product,
  type ProductInput,
  type Order,
  type OrderStatus
} from "@/api/closet/billing";
import { formatTime } from "../useClosetRequest";
import BillingFrame from "./BillingFrame.vue";
import { integer, money, useBilling } from "./useBilling";
defineOptions({ name: "ClosetBillingProducts" });
const { can, loading, saving, error, load, write } = useBilling();
const products = ref<Product[]>([]);
const orders = ref<Order[]>([]);
const status = ref<OrderStatus>();
const limit = ref(100);
const statuses: OrderStatus[] = [
  "CREATED",
  "PAID",
  "FULFILLED",
  "CLOSED",
  "FAILED",
  "DISPUTED"
];
const dialog = ref(false);
const editingId = ref("");
const defaults = (): ProductInput => ({
  kind: "POINTS",
  name: "",
  currency: "CNY",
  priceMinor: 1,
  points: 0,
  entDays: 30,
  entImageDailyLimit: 0,
  entAgentDailyLimit: 0,
  enabled: false,
  sortOrder: 0
});
const form = reactive(defaults());
const valid = computed(
  () =>
    form.name.trim() &&
    /^[A-Z]{3}$/.test(form.currency) &&
    integer(form.priceMinor, 1, 100000000) &&
    integer(form.sortOrder, -2147483648, 2147483647) &&
    (editingId.value ||
      (form.kind === "POINTS"
        ? integer(form.points, 1, 10000000)
        : integer(form.entDays, 1, 3650) &&
          integer(form.entImageDailyLimit, 0, 1000) &&
          integer(form.entAgentDailyLimit, 0, 1000)))
);
const refresh = () => {
  if (!integer(limit.value, 1, 500)) return;
  return load(
    () => Promise.all([getProducts(), getOrders(status.value, limit.value)]),
    ([p, o]) => {
      products.value = p.data;
      orders.value = o.data;
    }
  );
};
function edit(product?: Product) {
  editingId.value = product?.id || "";
  Object.assign(form, defaults(), product || {});
  dialog.value = true;
}
function save() {
  if (!valid.value) return;
  const change = {
    name: form.name.trim(),
    priceMinor: form.priceMinor,
    enabled: form.enabled,
    sortOrder: form.sortOrder
  };
  const data: ProductInput = {
    ...change,
    kind: form.kind,
    currency: form.currency,
    ...(form.kind === "POINTS"
      ? { points: form.points }
      : {
          entDays: form.entDays,
          entImageDailyLimit: form.entImageDailyLimit,
          entAgentDailyLimit: form.entAgentDailyLimit
        })
  };
  void write(
    "保存商品",
    () =>
      editingId.value ? putProduct(editingId.value, change) : postProduct(data),
    () => {
      dialog.value = false;
      void refresh();
    }
  );
}
function dispute(order: Order) {
  if (order.channel !== "sandbox") return;
  void write(
    "拒付演练",
    () => disputeOrder(order.id),
    () => void refresh(),
    `确认对沙箱订单 ${order.id} 演练拒付？这将撤销发放并冲回点数。`
  );
}
onMounted(() => {
  if (can("closet:billing:read")) void refresh();
});
</script>
<template>
  <BillingFrame
    title="商品与订单"
    :error="error"
    :loading="loading"
    :saving="saving"
    @refresh="refresh"
  >
    <el-card shadow="never">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">商品</h3>
        <el-button
          v-if="can('closet:billing:write')"
          :disabled="saving"
          type="primary"
          @click="edit()"
          >新建商品</el-button
        >
      </div>
      <el-table :data="products" stripe
        ><el-table-column
          prop="name"
          label="名称"
          min-width="150"
        /><el-table-column
          prop="kind"
          label="类型"
          min-width="150"
        /><el-table-column
          prop="currency"
          label="币种"
          width="90"
        /><el-table-column label="价格（元）" min-width="120"
          ><template #default="{ row }">{{
            money(row.priceMinor)
          }}</template></el-table-column
        ><el-table-column
          prop="points"
          label="点数"
          width="100"
        /><el-table-column
          prop="entDays"
          label="权益天数"
          width="100"
        /><el-table-column
          prop="entImageDailyLimit"
          label="图片日额度"
          width="110"
        /><el-table-column
          prop="entAgentDailyLimit"
          label="助手日额度"
          width="110"
        /><el-table-column
          prop="sortOrder"
          label="排序"
          width="90"
        /><el-table-column label="状态" width="100"
          ><template #default="{ row }">{{
            row.enabled ? "已上架" : "已下架"
          }}</template></el-table-column
        ><el-table-column
          v-if="can('closet:billing:write')"
          label="操作"
          width="90"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :disabled="saving"
              @click="edit(row)"
              >编辑</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </el-card>
    <el-card shadow="never">
      <h3 class="mb-3 font-semibold">订单</h3>
      <el-form inline
        ><el-form-item label="状态"
          ><el-select v-model="status" clearable class="!w-44" @change="refresh"
            ><el-option
              v-for="s in statuses"
              :key="s"
              :value="s"
              :label="s" /></el-select></el-form-item
        ><el-form-item label="最近条数"
          ><el-input-number
            v-model="limit"
            :min="1"
            :max="500"
            :precision="0" /></el-form-item
        ><el-button :disabled="!integer(limit, 1, 500)" @click="refresh"
          >查询</el-button
        ></el-form
      >
      <el-table :data="orders" stripe
        ><el-table-column
          prop="id"
          label="订单号"
          min-width="260"
        /><el-table-column
          prop="userKey"
          label="userKey"
          min-width="200"
        /><el-table-column
          prop="productName"
          label="商品"
          min-width="150"
        /><el-table-column
          prop="currency"
          label="币种"
          width="90"
        /><el-table-column label="金额（元）" width="130"
          ><template #default="{ row }">{{
            money(row.amountMinor)
          }}</template></el-table-column
        ><el-table-column label="手续费（元）" width="150"
          ><template #default="{ row }"
            >{{ money(row.feeMinor)
            }}{{ row.feeEstimated ? "（渠道未报告）" : "" }}</template
          ></el-table-column
        ><el-table-column
          prop="channel"
          label="渠道"
          width="110"
        /><el-table-column
          prop="status"
          label="状态"
          width="120"
        /><el-table-column label="创建时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.createdAtMs)
          }}</template></el-table-column
        ><el-table-column
          v-if="can('closet:billing:write')"
          label="操作"
          width="130"
          ><template #default="{ row }"
            ><el-button
              v-if="row.channel === 'sandbox'"
              link
              type="danger"
              :disabled="saving || row.status === 'DISPUTED'"
              @click="dispute(row)"
              >拒付演练</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </el-card>
    <el-dialog
      v-model="dialog"
      :title="editingId ? '编辑商品' : '新建商品'"
      width="min(600px, 94vw)"
      :close-on-click-modal="false"
      :before-close="
        done => {
          if (!saving) done();
        }
      "
    >
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="名称"
          ><el-input v-model="form.name" maxlength="120"
        /></el-form-item>
        <el-form-item label="类型"
          ><el-select v-model="form.kind" :disabled="!!editingId"
            ><el-option value="POINTS" label="点数包" /><el-option
              value="SUBSCRIPTION"
              label="订阅" /></el-select
        ></el-form-item>
        <el-form-item label="币种（三位大写代码）"
          ><el-input
            v-model="form.currency"
            maxlength="3"
            :disabled="!!editingId"
        /></el-form-item>
        <el-form-item label="金额（最小货币单位，如分 / cent）"
          ><el-input-number
            v-model="form.priceMinor"
            :min="1"
            :max="100000000"
            :precision="0"
          /><span class="ml-3"
            >{{ form.currency }} {{ money(form.priceMinor) }} 元</span
          ></el-form-item
        >
        <el-form-item v-if="form.kind === 'POINTS'" label="发放点数"
          ><el-input-number
            v-model="form.points"
            :min="1"
            :max="10000000"
            :precision="0"
            :disabled="!!editingId"
        /></el-form-item>
        <template v-else
          ><el-form-item label="权益天数"
            ><el-input-number
              v-model="form.entDays"
              :min="1"
              :max="3650"
              :precision="0"
              :disabled="!!editingId" /></el-form-item
          ><el-form-item label="图片日额度"
            ><el-input-number
              v-model="form.entImageDailyLimit"
              :min="0"
              :max="1000"
              :precision="0"
              :disabled="!!editingId" /></el-form-item
          ><el-form-item label="助手日额度"
            ><el-input-number
              v-model="form.entAgentDailyLimit"
              :min="0"
              :max="1000"
              :precision="0"
              :disabled="!!editingId" /></el-form-item
        ></template>
        <el-form-item label="上架"
          ><el-switch v-model="form.enabled" /></el-form-item
        ><el-form-item label="排序"
          ><el-input-number v-model="form.sortOrder" :precision="0"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!valid"
          :loading="saving"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </BillingFrame>
</template>
