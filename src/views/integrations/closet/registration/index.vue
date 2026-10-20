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
import { useClosetRequest } from "../useClosetRequest";
import {
  actorLabel,
  dateTime,
  inviteStatusNames,
  inviteStatusTypes,
  registrationModeHints,
  registrationModeNames,
  remainingText
} from "../accountLabels";
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
const status = ref<InviteStatus | "">("");
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
const modes = Object.keys(registrationModeNames) as RegistrationMode[];
const pick = (value: RegistrationMode) => {
  if (!state.value || value === state.value.mode || saving.value) return;
  if (!can("closet:registration:write")) return;
  mode.value = value;
  void changeMode();
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
      `撤销${invite.note ? `“${invite.note}”` : "这个邀请码"}？撤销后不能再用于注册，也无法编辑；已注册的账号不受影响。`,
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
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <template v-else>
      <el-card v-loading="loading && !state" shadow="never">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <div class="mr-auto">
              <h2 class="text-base font-semibold">注册方式</h2>
              <p class="text-xs text-[var(--el-text-color-secondary)]">
                决定鱼搭用户端能否自助注册，修改后立即生效。
              </p>
            </div>
            <el-button :loading="loading" :disabled="saving" @click="load"
              >刷新</el-button
            >
          </div>
        </template>
        <template v-if="state">
          <div class="modes" role="radiogroup" aria-label="注册方式">
            <button
              v-for="value in modes"
              :key="value"
              type="button"
              role="radio"
              class="mode"
              :class="{ active: state.mode === value }"
              :aria-checked="state.mode === value"
              :disabled="saving || !can('closet:registration:write')"
              @click="pick(value)"
            >
              <span class="mode-title">
                {{ registrationModeNames[value] }}
                <el-tag v-if="state.mode === value" size="small" type="primary"
                  >当前</el-tag
                >
                <el-tag
                  v-if="state.configuredMode === value"
                  size="small"
                  type="info"
                  effect="plain"
                  >部署默认</el-tag
                >
              </span>
              <span class="mode-hint">{{ registrationModeHints[value] }}</span>
            </button>
          </div>
          <div class="mode-footer">
            <span v-if="state.overridden"
              >已由 {{ actorLabel(state.updatedBy || "manage") }} 于
              {{ dateTime(state.updatedAtMs) }} 覆盖部署默认（{{
                registrationModeNames[state.configuredMode]
              }}）。</span
            >
            <span v-else
              >正在使用部署默认（环境变量 CLOSET_REGISTRATION）。</span
            >
            <el-button
              v-if="state.overridden && can('closet:registration:write')"
              link
              type="primary"
              :disabled="saving"
              @click="changeMode(true)"
              >恢复部署默认</el-button
            >
            <span class="ml-auto"
              >可用邀请码 <b>{{ state.activeInviteCount }}</b> 个</span
            >
          </div>
          <el-alert
            v-if="state.mode === 'INVITE' && state.activeInviteCount === 0"
            class="mt-3"
            type="warning"
            :closable="false"
            show-icon
            title="当前仅限邀请注册，但没有可用的邀请码，新用户暂时无法注册。"
          />
        </template>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <div class="mr-auto">
              <h2 class="text-base font-semibold">邀请码</h2>
              <p class="text-xs text-[var(--el-text-color-secondary)]">
                共 {{ total }} 个；邀请码原文只在创建时显示一次。
              </p>
            </div>
            <el-radio-group
              v-model="status"
              size="small"
              :disabled="saving"
              @change="search"
            >
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button
                v-for="(label, value) in inviteStatusNames"
                :key="value"
                :value="value"
                >{{ label }}</el-radio-button
              >
            </el-radio-group>
            <el-button
              v-if="can('closet:registration:write')"
              type="primary"
              :disabled="saving || loading"
              @click="edit()"
              >创建邀请码</el-button
            >
          </div>
        </template>
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="id"
          class="clickable-rows"
          :empty-text="status ? '没有该状态的邀请码' : '还没有邀请码'"
          @row-click="showDetail"
        >
          <el-table-column label="邀请码" min-width="200">
            <template #default="{ row }">
              <div class="truncate font-medium">
                {{ row.note || "未填写备注" }}
              </div>
              <div
                class="font-mono text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ row.id.slice(0, 8) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }"
              ><el-tag
                :type="
                  inviteStatusTypes[
                    row.status as keyof typeof inviteStatusTypes
                  ] ?? 'info'
                "
                effect="plain"
                >{{
                  inviteStatusNames[
                    row.status as keyof typeof inviteStatusNames
                  ] ?? row.status
                }}</el-tag
              ></template
            >
          </el-table-column>
          <el-table-column label="使用情况" min-width="140">
            <template #default="{ row }">
              <div class="usage">
                <el-progress
                  :percentage="Math.round((row.usedCount / row.maxUses) * 100)"
                  :show-text="false"
                  :stroke-width="6"
                  class="flex-1"
                />
                <span class="tabular-nums"
                  >{{ row.usedCount }}/{{ row.maxUses }}</span
                >
              </div>
            </template>
          </el-table-column>
          <el-table-column label="到期" min-width="150">
            <template #default="{ row }">
              <div>{{ dateTime(row.expiresAtMs) }}</div>
              <div
                v-if="row.status === 'ACTIVE'"
                class="text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ remainingText(row.expiresAtMs) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="创建" min-width="150">
            <template #default="{ row }">
              <div class="truncate">{{ actorLabel(row.createdBy) }}</div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                {{ dateTime(row.createdAtMs) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="can('closet:registration:write')"
            label=""
            width="110"
            fixed="right"
            align="right"
          >
            <template #default="{ row }"
              ><template v-if="row.status !== 'REVOKED'"
                ><el-button
                  link
                  type="primary"
                  :disabled="saving || loading"
                  @click.stop="edit(row)"
                  >编辑</el-button
                ><el-button
                  link
                  type="danger"
                  :disabled="saving || loading"
                  @click.stop="revoke(row)"
                  >撤销</el-button
                ></template
              ></template
            >
          </el-table-column>
        </el-table>
        <div class="mt-4 flex justify-end">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            background
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

<style scoped>
.modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (width <= 760px) {
  .modes {
    grid-template-columns: 1fr;
  }
}

.mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.mode:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
}

.mode:disabled {
  cursor: not-allowed;
}

.mode.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.mode-title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mode-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mode-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mode-footer b {
  color: var(--el-text-color-primary);
}

.usage {
  display: flex;
  gap: 8px;
  align-items: center;
}

.clickable-rows :deep(.el-table__row) {
  cursor: pointer;
}
</style>
