<script setup lang="ts">
import {
  createIpRule,
  deleteIpRule,
  listIpRules,
  toEpochOrNull,
  type IpAccessRule,
  type IpAccessRulePayload
} from "@/api/security";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../admin-code-presentation.mjs";
defineOptions({ name: "IpRuleManagement" });
const { can } = useCurrentPermissions();
const rows = ref<IpAccessRule[]>([]),
  loading = ref(false),
  dialog = ref(false),
  expiresAt = ref<Date>();
const form = reactive<{
  type: "ALLOW" | "DENY";
  network: string;
  reason: string;
}>({ type: "DENY", network: "", reason: "" });
const load = async () => {
  loading.value = true;
  try {
    rows.value = (await listIpRules()).data;
  } finally {
    loading.value = false;
  }
};
const open = () => {
  Object.assign(form, { type: "DENY", network: "", reason: "" });
  expiresAt.value = undefined;
  dialog.value = true;
};
const save = async () => {
  const data: IpAccessRulePayload = {
    ...form,
    expiresAt: toEpochOrNull(expiresAt.value)
  };
  await ElMessageBox.confirm(
    "IP 访问规则会立即生效，确认保存？",
    "高风险配置",
    { type: "warning" }
  );
  await createIpRule(data);
  dialog.value = false;
  await load();
  message("IP 规则已创建", { type: "success" });
};
const remove = async (row: IpAccessRule) => {
  await ElMessageBox.confirm(`删除 ${row.network} 规则？`, "删除规则", {
    type: "warning"
  });
  await deleteIpRule(row.id);
  await load();
};
onMounted(load);
</script>
<template>
  <div class="page-root">
    <el-card shadow="never"
      ><template #header
        ><div class="flex flex-wrap items-center justify-between gap-3">
          <span>IP 访问规则</span
          ><el-button
            v-if="can('system:config:write')"
            type="primary"
            @click="open"
            >新增规则</el-button
          >
        </div></template
      ><el-table v-loading="loading" :data="rows"
        ><el-table-column label="类型" width="100"
          ><template #default="{ row }"
            ><el-tooltip :content="adminCodeTooltip('ipRuleType', row.type)"
              ><el-tag :type="row.type === 'ALLOW' ? 'success' : 'danger'">{{
                adminCodeLabel("ipRuleType", row.type)
              }}</el-tag></el-tooltip
            ></template
          ></el-table-column
        ><el-table-column
          prop="network"
          label="网络/CIDR"
          min-width="180"
        /><el-table-column label="范围" width="120"
          ><template #default="{ row }"
            ><el-tooltip :content="adminCodeTooltip('ipScope', row.scope)">{{
              adminCodeLabel("ipScope", row.scope)
            }}</el-tooltip></template
          ></el-table-column
        ><el-table-column label="过期时间" min-width="180"
          ><template #default="{ row }">{{
            row.expiresAt
              ? new Date(row.expiresAt).toLocaleString()
              : "永不过期"
          }}</template></el-table-column
        ><el-table-column
          prop="reason"
          label="原因"
          min-width="220"
        /><el-table-column
          v-if="can('system:config:write')"
          label="操作"
          width="90"
          ><template #default="{ row }"
            ><el-button link type="danger" @click="remove(row)"
              >删除</el-button
            ></template
          ></el-table-column
        ></el-table
      ></el-card
    >
    <el-dialog v-model="dialog" title="新增 IP 规则" width="500px"
      ><el-form label-width="90px"
        ><el-form-item label="类型"
          ><el-radio-group v-model="form.type"
            ><el-radio-button value="ALLOW">允许访问</el-radio-button
            ><el-radio-button value="DENY"
              >拒绝访问</el-radio-button
            ></el-radio-group
          ></el-form-item
        ><el-form-item label="网络"
          ><el-input
            v-model="form.network"
            placeholder="203.0.113.0/24" /></el-form-item
        ><el-form-item label="过期时间"
          ><el-date-picker
            v-model="expiresAt"
            type="datetime"
            clearable /></el-form-item
        ><el-form-item label="原因"
          ><el-input
            v-model="form.reason"
            type="textarea" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" @click="save">保存</el-button></template
      ></el-dialog
    >
  </div>
</template>
