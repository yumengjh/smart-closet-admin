<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  getClosetRegistration,
  updateClosetRegistration,
  listClosetInvites,
  revokeClosetInvite,
  type RegistrationMode,
  type RegistrationState,
  type Invite,
  type InviteStatus
} from "@/api/closet/registration";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import { inviteStatusNames, registrationModeNames } from "../accountLabels";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import InviteFormDialog from "./InviteFormDialog.vue";
import InviteResultDialog from "./InviteResultDialog.vue";
import InviteDetailDrawer from "./InviteDetailDrawer.vue";
defineOptions({ name: "ClosetRegistration" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const state = ref<RegistrationState>();
const mode = ref<RegistrationMode>("CLOSED");
const rows = ref<Invite[]>([]);
const status = ref<InviteStatus>();
const page = ref(1);
const size = ref(20);
const total = ref(0);
const saving = ref(false);
const formOpen = ref(false);
const editing = ref<Invite>();
const detailOpen = ref(false);
const detailId = ref<string>();
const resultOpen = ref(false);
const code = ref("");
const load = () => {
  if (!can("closet:registration:read")) return;
  return run(
    () =>
      Promise.all([
        getClosetRegistration(),
        listClosetInvites({
          status: status.value || undefined,
          page: page.value - 1,
          size: size.value
        })
      ]),
    ([registration, invites]) => {
      state.value = registration.data;
      mode.value = registration.data.mode;
      rows.value = invites.data.items;
      total.value = invites.data.totalElements;
    }
  );
};
const search = () => {
  page.value = 1;
  void load();
};
const changeMode = async (restore = false) => {
  if (!can("closet:registration:write") || !state.value || saving.value) return;
  const target = restore ? null : mode.value;
  saving.value = true;
  try {
    await ElMessageBox.confirm(
      restore
        ? `恢复部署默认模式“${registrationModeNames[state.value.configuredMode]}”？`
        : `将注册模式切换为“${registrationModeNames[mode.value]}”？此设置立即生效。`,
      "修改注册模式",
      {
        type: "warning",
        confirmButtonText: restore ? "恢复部署默认" : "切换模式",
        cancelButtonText: "取消"
      }
    );
    const { data } = await updateClosetRegistration(target);
    state.value = data;
    mode.value = data.mode;
    message("注册模式已更新", { type: "success" });
    await load();
  } catch (error) {
    mode.value = state.value.mode;
    if (error === "cancel" || error === "close") return;
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("修改注册模式失败，请刷新后重试", { type: "error" });
  } finally {
    saving.value = false;
  }
};
const edit = (invite?: Invite) => {
  editing.value = invite;
  formOpen.value = true;
};
const showDetail = (invite: Invite) => {
  detailId.value = invite.id;
  detailOpen.value = true;
};
const created = (value: string) => {
  code.value = value;
  resultOpen.value = true;
  void load();
};
const revoke = async (invite: Invite) => {
  if (!can("closet:registration:write") || saving.value) return;
  saving.value = true;
  try {
    await ElMessageBox.confirm(
      `撤销邀请码 ${invite.id}？撤销后无法继续使用，也无法编辑。已注册账号不受影响。`,
      "撤销邀请码",
      {
        type: "warning",
        confirmButtonText: "撤销邀请码",
        cancelButtonText: "取消"
      }
    );
    await revokeClosetInvite(invite.id);
    message("邀请码已撤销", { type: "success" });
    await load();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("撤销失败，请刷新后重试", { type: "error" });
  } finally {
    saving.value = false;
  }
};
onMounted(() => void load());
</script>
<template>
  <div class="page-root space-y-4">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="mr-auto text-lg font-semibold">注册与邀请</h2>
        <el-button
          v-if="can('closet:registration:read')"
          :loading="loading"
          :disabled="saving"
          @click="load"
          >刷新</el-button
        >
      </div>
    </el-card>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <template v-else>
      <el-card v-loading="loading" shadow="never">
        <template #header>注册模式</template>
        <template v-if="state">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="当前生效"
              ><el-tag>{{
                registrationModeNames[state.mode]
              }}</el-tag></el-descriptions-item
            >
            <el-descriptions-item label="部署默认">{{
              registrationModeNames[state.configuredMode]
            }}</el-descriptions-item>
            <el-descriptions-item label="运行时覆盖">{{
              state.overridden ? "已覆盖部署默认" : "使用部署默认"
            }}</el-descriptions-item>
            <el-descriptions-item label="修改人 / 时间"
              >{{ state.updatedBy || "无" }} /
              {{ formatTime(state.updatedAtMs) }}</el-descriptions-item
            >
            <el-descriptions-item label="可用邀请码">{{
              state.activeInviteCount
            }}</el-descriptions-item>
          </el-descriptions>
          <p class="my-3 text-sm">
            关闭注册时不接受新注册；仅限邀请时须持有效邀请码；开放注册时用户可直接注册。
          </p>
          <div
            v-if="can('closet:registration:write')"
            class="flex flex-wrap items-center gap-3"
          >
            <el-select
              v-model="mode"
              class="!w-40"
              aria-label="注册模式"
              :disabled="saving || loading"
              ><el-option
                v-for="(label, value) in registrationModeNames"
                :key="value"
                :label="label"
                :value="value"
            /></el-select>
            <el-button
              type="primary"
              :loading="saving"
              :disabled="loading || mode === state.mode"
              @click="changeMode()"
              >切换模式</el-button
            >
            <el-button
              :disabled="saving || loading || !state.overridden"
              @click="changeMode(true)"
              >恢复部署默认</el-button
            >
          </div>
        </template>
      </el-card>
      <el-card shadow="never">
        <template #header
          ><div class="flex flex-wrap items-center gap-3">
            <h3 class="mr-auto font-medium">邀请码</h3>
            <el-select
              v-model="status"
              class="!w-40"
              placeholder="全部状态"
              clearable
              :disabled="saving"
              @change="search"
              ><el-option
                v-for="(label, value) in inviteStatusNames"
                :key="value"
                :label="label"
                :value="value" /></el-select
            ><el-button
              v-if="can('closet:registration:write')"
              type="primary"
              :disabled="saving || loading"
              @click="edit()"
              >创建邀请码</el-button
            >
          </div></template
        >
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="id"
          empty-text="暂无邀请码"
        >
          <el-table-column
            prop="id"
            label="邀请码 ID"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="note"
            label="备注"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column label="状态" width="110"
            ><template #default="{ row }"
              ><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{
                inviteStatusNames[row.status] ?? row.status
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column label="已用 / 名额" width="110"
            ><template #default="{ row }"
              >{{ row.usedCount }} / {{ row.maxUses }}</template
            ></el-table-column
          >
          <el-table-column label="到期时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.expiresAtMs)
            }}</template></el-table-column
          >
          <el-table-column
            prop="createdBy"
            label="创建者"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column label="创建时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.createdAtMs)
            }}</template></el-table-column
          >
          <el-table-column label="操作" fixed="right" width="180"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="showDetail(row)"
                >详情</el-button
              ><template v-if="can('closet:registration:write')"
                ><el-button
                  link
                  type="primary"
                  :disabled="saving || loading || row.status === 'REVOKED'"
                  @click="edit(row)"
                  >编辑</el-button
                ><el-button
                  link
                  type="danger"
                  :disabled="saving || loading || row.status === 'REVOKED'"
                  @click="revoke(row)"
                  >撤销</el-button
                ></template
              ></template
            ></el-table-column
          >
        </el-table>
        <div class="mt-4 overflow-x-auto">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            :total="total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            :disabled="saving"
            @current-change="load"
            @size-change="search"
          />
        </div>
      </el-card>
    </template>
    <InviteFormDialog
      v-model="formOpen"
      :invite="editing"
      @created="created"
      @saved="load"
      @unavailable="unavailable = true"
    />
    <InviteResultDialog v-model="resultOpen" :code="code" @closed="code = ''" />
    <InviteDetailDrawer :id="detailId" v-model="detailOpen" />
  </div>
</template>
