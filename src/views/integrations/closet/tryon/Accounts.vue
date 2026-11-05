<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useWindowSize } from "@vueuse/core";
import {
  listTryOnAccounts,
  getTryOnAccount,
  registerTryOnAccount,
  updateTryOnAccount,
  rotateTryOnCredential,
  removeTryOnCredential,
  probeTryOnAccount,
  updateTryOnAccountBudget,
  stopTryOnAccountSessions,
  type TryOnAccount,
  type TryOnAccountChange,
  type TryOnCredentialInput
} from "@/api/closet/tryon";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useTryOnAction } from "./useTryOnAction";
const { width } = useWindowSize();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const detailRequest = useClosetRequest();
const { can, saving, actionError, act } = useTryOnAction();
const accounts = ref<TryOnAccount[]>([]);
const selected = ref<TryOnAccount>();
const drawer = ref(false);
const credentialOpen = ref(false);
const credentialAccount = ref<TryOnAccount>();
const credential = reactive<TryOnCredentialInput>({
  name: "",
  environment: "china",
  apiKey: ""
});
const form = reactive<TryOnAccountChange>({
  name: "",
  accepting: false,
  weight: 1,
  concurrencyLimit: 1
});
const budget = ref<number>();
const query = ref("");
const rows = computed(() =>
  accounts.value.filter(row =>
    `${row.name} ${row.provider_user_id}`
      .toLowerCase()
      .includes(query.value.toLowerCase())
  )
);
const load = () =>
  run(listTryOnAccounts, ({ data }) => {
    accounts.value = data;
  });
const apply = (data: TryOnAccount) => {
  selected.value = data;
  Object.assign(form, {
    name: data.name,
    accepting: Boolean(data.accepting),
    weight: data.weight,
    concurrencyLimit: data.concurrency_limit
  });
  budget.value = data.budget_points;
};
const detail = async (id: string) => {
  drawer.value = true;
  selected.value = undefined;
  await detailRequest.run(
    () => getTryOnAccount(id),
    ({ data }) => apply(data)
  );
};
const refreshDetail = async () => {
  if (selected.value) await detail(selected.value.id);
};
const openCredential = (account?: TryOnAccount) => {
  credentialAccount.value = account;
  Object.assign(credential, {
    name: account?.name ?? "",
    environment: account?.environment ?? "china",
    apiKey: ""
  });
  credentialOpen.value = true;
};
const clearCredential = () => {
  Object.assign(credential, { name: "", environment: "china", apiKey: "" });
  credentialAccount.value = undefined;
};
const credentialValid = computed(
  () =>
    credential.name.trim().length > 0 &&
    credential.name.length <= 80 &&
    /^uk-[A-Za-z0-9_-]{8,500}$/.test(credential.apiKey)
);
const saveCredential = async () => {
  if (!credentialValid.value) return;
  const account = credentialAccount.value;
  const data = { ...credential };
  const result = await act(
    "credentials",
    account ? "轮换账户凭证" : "登记运营账户",
    account
      ? "新凭证必须属于此供应商账户。现有会话仍使用原凭证，确认轮换？"
      : "将验证供应商余额并登记此运营账户，确认提交？",
    () =>
      account
        ? rotateTryOnCredential(account.id, data)
        : registerTryOnAccount(data)
  );
  // Clear plaintext on every submission outcome, including confirmation cancellation.
  credential.apiKey = "";
  if (result) {
    credentialOpen.value = false;
    if (selected.value?.id === result.data.id) apply(result.data);
    await load();
  }
};
const accountValid = computed(
  () =>
    form.name.trim().length > 0 &&
    form.name.length <= 80 &&
    Number.isInteger(form.weight) &&
    form.weight >= 1 &&
    form.weight <= 100 &&
    Number.isInteger(form.concurrencyLimit) &&
    form.concurrencyLimit >= 1 &&
    form.concurrencyLimit <= 100
);
const saveAccount = async () => {
  if (!selected.value || !accountValid.value) return;
  const id = selected.value.id;
  const data = { ...form };
  const result = await act(
    "write",
    "保存账户调度",
    "暂停接单后已有会话自然结束；新调度配置影响后续分配。确认保存？",
    () => updateTryOnAccount(id, data)
  );
  if (result) {
    apply(result.data);
    await load();
  }
};
const saveBudget = async () => {
  if (
    !selected.value ||
    budget.value == null ||
    !Number.isInteger(budget.value) ||
    budget.value < 0 ||
    budget.value > 1000000000000
  )
    return;
  const id = selected.value.id;
  const points = budget.value;
  const result = await act(
    "budget",
    "调整账户支出授权",
    `将账户累计支出授权上界设为 ${points} 积分。历史消耗与在途预留仍会扣减，确认调整？`,
    () => updateTryOnAccountBudget(id, points)
  );
  if (result) {
    apply(result.data);
    await load();
  }
};
const probe = async (account: TryOnAccount) => {
  const result = await act(
    "probe",
    "探测账户余额",
    `查询“${account.name}”的供应商余额与健康状态，不自动增加本地授权。确认探测？`,
    () => probeTryOnAccount(account.id)
  );
  if (result) {
    if (selected.value?.id === account.id) apply(result.data);
    await load();
  }
};
const remove = async (id: string) => {
  if (!selected.value) return;
  const account = selected.value.id;
  const result = await act(
    "credentials",
    "停用账户凭证",
    "仅能停用未被在途会话引用的凭证。最后一个可用凭证停用后，账户将停止接单。确认停用？",
    () => removeTryOnCredential(account, id)
  );
  if (result) {
    await detail(account);
    await load();
  }
};
const stop = async () => {
  if (!selected.value) return;
  const account = selected.value;
  const result = await act(
    "stop",
    "停止账户全部会话",
    `紧急停止“${account.name}”全部在途会话。未知费用仍保留预算并继续核对，确认停止？`,
    () => stopTryOnAccountSessions(account.id)
  );
  if (result) {
    await detail(account.id);
    await load();
  }
};
onBeforeUnmount(clearCredential);
onMounted(() => void load());
</script>
<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <el-input
        v-model="query"
        class="!w-64"
        placeholder="搜索名称或供应商账号"
        clearable
      /><el-button :loading="loading" :disabled="saving" @click="load"
        >刷新账户</el-button
      ><el-button
        v-if="can('closet:tryon:credentials')"
        type="primary"
        :disabled="saving"
        @click="openCredential()"
        >登记运营账户</el-button
      >
    </div>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-alert
      v-if="actionError"
      :title="actionError"
      type="error"
      :closable="false"
    />
    <el-table
      v-loading="loading"
      :data="rows"
      row-key="id"
      empty-text="暂无运营账户，可登记供应商账户后配置支出授权"
    >
      <el-table-column prop="name" label="账户名称" min-width="150" />
      <el-table-column label="环境" min-width="90"
        ><template #default="{ row }">{{
          row.environment === "china" ? "国内" : "海外"
        }}</template></el-table-column
      >
      <el-table-column label="接单 / 健康" min-width="160"
        ><template #default="{ row }"
          ><el-tag :type="row.accepting ? 'success' : 'info'">{{
            row.accepting ? "接单中" : "已暂停"
          }}</el-tag
          ><el-tag class="ml-2" :type="row.healthy ? 'success' : 'danger'">{{
            row.healthy ? "正常" : "异常"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column
        prop="balance_points"
        label="余额（积分）"
        min-width="120"
      />
      <el-table-column
        prop="availablePoints"
        label="可用预算（积分）"
        min-width="150"
      />
      <el-table-column label="并发" min-width="90"
        ><template #default="{ row }"
          >{{ row.activeSessions }} / {{ row.concurrency_limit }}</template
        ></el-table-column
      >
      <el-table-column label="操作" min-width="140" fixed="right"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            :disabled="saving"
            @click="detail(row.id)"
            >详情</el-button
          ><el-button
            v-if="can('closet:tryon:probe')"
            link
            type="primary"
            :disabled="saving"
            @click="probe(row)"
            >探测余额</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-drawer
      v-model="drawer"
      title="运营账户详情"
      :size="width < 768 ? '100%' : '640px'"
      :show-close="!saving"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
    >
      <el-skeleton v-if="detailRequest.loading.value" :rows="6" animated />
      <el-alert
        v-if="
          detailRequest.errorMessage.value || detailRequest.unavailable.value
        "
        title="账户详情读取失败，请关闭后重新打开。"
        type="error"
        :closable="false"
      />
      <el-alert
        v-if="actionError"
        :title="actionError"
        type="error"
        :closable="false"
        class="mb-4"
      />
      <template v-if="selected">
        <el-descriptions :column="1" border class="mb-5"
          ><el-descriptions-item label="供应商账户">{{
            selected.provider_user_id
          }}</el-descriptions-item
          ><el-descriptions-item label="累计授权"
            >{{ selected.budget_points }} 积分</el-descriptions-item
          ><el-descriptions-item label="当前可用"
            >{{ selected.availablePoints }} 积分</el-descriptions-item
          ><el-descriptions-item label="余额更新时间">{{
            formatTime(selected.balance_at_ms)
          }}</el-descriptions-item></el-descriptions
        >
        <el-form
          label-position="top"
          :disabled="!can('closet:tryon:write') || saving"
          @submit.prevent="saveAccount"
          ><el-form-item label="账户名称"
            ><el-input v-model="form.name" maxlength="80" /></el-form-item
          ><el-form-item label="接受新会话"
            ><el-switch v-model="form.accepting"
          /></el-form-item>
          <div class="grid grid-cols-2 gap-4">
            <el-form-item label="调度权重"
              ><el-input-number
                v-model="form.weight"
                class="!w-full"
                :min="1"
                :max="100"
                :precision="0" /></el-form-item
            ><el-form-item label="并发上限"
              ><el-input-number
                v-model="form.concurrencyLimit"
                class="!w-full"
                :min="1"
                :max="100"
                :precision="0"
            /></el-form-item>
          </div>
          <el-button
            v-if="can('closet:tryon:write')"
            type="primary"
            :disabled="!accountValid"
            :loading="saving"
            @click="saveAccount"
            >保存账户调度</el-button
          ></el-form
        >
        <el-divider />
        <el-form
          label-position="top"
          :disabled="!can('closet:tryon:budget') || saving"
          @submit.prevent="saveBudget"
          ><el-form-item label="累计支出授权上界（积分）"
            ><el-input-number
              v-model="budget"
              class="!w-full"
              :min="0"
              :max="1000000000000"
              :precision="0" /></el-form-item
          ><el-button
            v-if="can('closet:tryon:budget')"
            :loading="saving"
            @click="saveBudget"
            >调整账户支出授权</el-button
          ></el-form
        >
        <el-divider />
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-semibold">账户凭证</h3>
          <el-button
            v-if="can('closet:tryon:credentials')"
            :disabled="saving"
            @click="openCredential(selected)"
            >轮换账户凭证</el-button
          >
        </div>
        <el-table
          :data="selected.credentials"
          row-key="id"
          empty-text="暂无凭证"
          ><el-table-column
            prop="masked_key"
            label="脱敏凭证"
            min-width="120"
          /><el-table-column label="状态" min-width="85"
            ><template #default="{ row }">{{
              row.active ? "可用" : "已停用"
            }}</template></el-table-column
          ><el-table-column label="操作" width="85"
            ><template #default="{ row }"
              ><el-button
                v-if="row.active && can('closet:tryon:credentials')"
                link
                type="danger"
                :disabled="saving"
                @click="remove(row.id)"
                >停用</el-button
              ></template
            ></el-table-column
          ></el-table
        >
        <div class="mt-5 flex flex-wrap gap-3">
          <el-button :disabled="saving" @click="refreshDetail"
            >刷新详情</el-button
          ><el-button
            v-if="can('closet:tryon:stop')"
            type="danger"
            plain
            :disabled="saving"
            @click="stop"
            >停止账户全部会话</el-button
          >
        </div>
      </template>
    </el-drawer>
    <el-dialog
      v-model="credentialOpen"
      :title="credentialAccount ? '轮换账户凭证' : '登记运营账户'"
      :width="width < 600 ? '94%' : '520px'"
      append-to-body
      :show-close="!saving"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      @closed="clearCredential"
    >
      <el-alert
        title="永久密钥只在本次提交中使用，关闭表单后清空。请勿填写到备注、名称或 URL。"
        type="info"
        :closable="false"
        class="mb-5"
      />
      <el-alert
        v-if="actionError"
        :title="actionError"
        type="error"
        :closable="false"
        class="mb-4"
      />
      <el-form
        label-position="top"
        :disabled="saving"
        @submit.prevent="saveCredential"
        ><el-form-item label="账户名称" required
          ><el-input
            v-model="credential.name"
            maxlength="80"
            autocomplete="off" /></el-form-item
        ><el-form-item label="供应商环境" required
          ><el-select
            v-model="credential.environment"
            class="w-full"
            :disabled="!!credentialAccount"
            ><el-option label="国内" value="china" /><el-option
              label="海外"
              value="global" /></el-select></el-form-item
        ><el-form-item label="永久 API key" required
          ><el-input
            v-model="credential.apiKey"
            type="password"
            autocomplete="new-password"
            placeholder="uk- 开头的供应商密钥"
            maxlength="503" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button :disabled="saving" @click="credentialOpen = false"
          >取消</el-button
        ><el-button
          type="primary"
          :disabled="!credentialValid"
          :loading="saving"
          @click="saveCredential"
          >{{ credentialAccount ? "轮换账户凭证" : "登记运营账户" }}</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
