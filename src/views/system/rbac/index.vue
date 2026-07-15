<script setup lang="ts">
import {
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  grantRolePermission,
  listPermissions,
  listRoles,
  revokeRolePermission,
  updatePermission,
  updateRole,
  type Permission,
  type Role
} from "@/api/rbac";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import {
  permissionOptionLabel,
  permissionOptionTooltip
} from "./permission-option.mjs";
import { ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { roleCodeError } from "../admin-contracts.mjs";

defineOptions({ name: "RbacManagement" });
const { can } = useCurrentPermissions();
const roles = ref<Role[]>([]),
  permissions = ref<Permission[]>([]),
  loading = ref(false);
const roleDialog = ref(false),
  permissionDialog = ref(false),
  editingRole = ref<string>(),
  editingPermission = ref<string>();
const roleFormRef = ref<FormInstance>();
const roleForm = reactive({ code: "", displayName: "" }),
  permissionForm = reactive({ code: "", description: "" });
const roleRules: FormRules = {
  code: [
    { required: true, message: "请输入角色编码", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        const error = roleCodeError(value);
        callback(error ? new Error(error) : undefined);
      },
      trigger: "blur"
    }
  ],
  displayName: [
    { required: true, message: "请输入角色名称", trigger: "blur" },
    { max: 160, message: "角色名称不能超过 160 个字符", trigger: "blur" }
  ]
};
const load = async () => {
  loading.value = true;
  try {
    [roles.value, permissions.value] = await Promise.all([
      listRoles().then(value => value.data),
      listPermissions().then(value => value.data)
    ]);
  } finally {
    loading.value = false;
  }
};
const editRole = (row?: Role) => {
  editingRole.value = row?.code;
  Object.assign(
    roleForm,
    row
      ? { code: row.code, displayName: row.displayName }
      : { code: "", displayName: "" }
  );
  roleDialog.value = true;
};
const saveRole = async () => {
  const valid = await roleFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (editingRole.value) await updateRole(editingRole.value, roleForm);
  else await createRole(roleForm);
  roleDialog.value = false;
  await load();
};
const removeRole = async (row: Role) => {
  await ElMessageBox.confirm(`删除角色 ${row.code}？`, "删除角色", {
    type: "warning"
  });
  await deleteRole(row.code);
  await load();
};
const editPermission = (row?: Permission) => {
  editingPermission.value = row?.code;
  Object.assign(
    permissionForm,
    row
      ? { code: row.code, description: row.description || "" }
      : { code: "", description: "" }
  );
  permissionDialog.value = true;
};
const savePermission = async () => {
  if (editingPermission.value)
    await updatePermission(editingPermission.value, permissionForm);
  else await createPermission(permissionForm);
  permissionDialog.value = false;
  await load();
};
const removePermission = async (row: Permission) => {
  await ElMessageBox.confirm(`删除权限 ${row.code}？`, "删除权限", {
    type: "warning"
  });
  await deletePermission(row.code);
  await load();
};
const updateRolePermissions = async (role: Role, next: string[]) => {
  const original = new Set(role.permissions),
    wanted = new Set(next);
  try {
    for (const code of next.filter(code => !original.has(code)))
      await grantRolePermission(role.code, code);
    for (const code of role.permissions.filter(code => !wanted.has(code)))
      await revokeRolePermission(role.code, code);
    message("角色权限已更新", { type: "success" });
    await load();
  } catch (error) {
    message("权限更新未完成，请刷新后重试", { type: "error" });
    throw error;
  }
};
onMounted(load);
</script>

<template>
  <div class="page-root">
    <el-tabs v-loading="loading" type="border-card">
      <el-tab-pane label="角色">
        <div class="mb-3 text-right">
          <el-button
            v-if="can('system:role:write')"
            type="primary"
            @click="editRole()"
            >新增角色</el-button
          >
        </div>
        <el-table :data="roles"
          ><el-table-column
            prop="code"
            label="编码"
            min-width="160"
          /><el-table-column
            prop="displayName"
            label="名称"
            min-width="150"
          /><el-table-column label="权限" min-width="440"
            ><template #default="{ row }"
              ><el-select
                :model-value="row.permissions"
                multiple
                filterable
                collapse-tags
                :disabled="!can('system:role:write')"
                class="w-full"
                @update:model-value="value => updateRolePermissions(row, value)"
                ><el-option
                  v-for="permission in permissions"
                  :key="permission.code"
                  :label="permissionOptionLabel(permission)"
                  :value="permission.code"
                  ><el-tooltip
                    :content="permissionOptionTooltip(permission)"
                    placement="right"
                    :show-after="250"
                    ><div class="permission-option">
                      <span>{{ permissionOptionLabel(permission) }}</span>
                      <small>{{ permission.code }}</small>
                    </div></el-tooltip
                  ></el-option
                ></el-select
              ></template
            ></el-table-column
          ><el-table-column
            v-if="can('system:role:write')"
            label="操作"
            width="130"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="editRole(row)"
                >编辑</el-button
              ><el-button link type="danger" @click="removeRole(row)"
                >删除</el-button
              ></template
            ></el-table-column
          ></el-table
        >
      </el-tab-pane>
      <el-tab-pane label="权限">
        <div class="mb-3 text-right">
          <el-button
            v-if="can('system:role:write')"
            type="primary"
            @click="editPermission()"
            >新增权限</el-button
          >
        </div>
        <el-table :data="permissions"
          ><el-table-column
            prop="code"
            label="编码"
            min-width="250"
          /><el-table-column
            prop="description"
            label="说明"
            min-width="280"
          /><el-table-column
            v-if="can('system:role:write')"
            label="操作"
            width="130"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="editPermission(row)"
                >编辑</el-button
              ><el-button link type="danger" @click="removePermission(row)"
                >删除</el-button
              ></template
            ></el-table-column
          ></el-table
        >
      </el-tab-pane>
    </el-tabs>
    <el-dialog
      v-model="roleDialog"
      :title="editingRole ? '编辑角色' : '新增角色'"
      width="420px"
      ><el-alert
        v-if="!editingRole"
        class="mb-4"
        title="角色编码规则"
        type="info"
        :closable="false"
        description="编码必须唯一，且只能使用 2–64 位大写英文字母和下划线，例如 CONTENT_EDITOR；不支持汉字、数字、空格或连字符，创建后不可修改。角色名称不能为空，最多 160 个字符。"
      /><el-form
        ref="roleFormRef"
        :model="roleForm"
        :rules="roleRules"
        label-width="70px"
        ><el-form-item label="编码" prop="code"
          ><el-input
            v-model="roleForm.code"
            :disabled="Boolean(editingRole)" /></el-form-item
        ><el-form-item label="名称" prop="displayName"
          ><el-input v-model="roleForm.displayName" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="roleDialog = false">取消</el-button
        ><el-button type="primary" @click="saveRole">保存</el-button></template
      ></el-dialog
    >
    <el-dialog
      v-model="permissionDialog"
      :title="editingPermission ? '编辑权限' : '新增权限'"
      width="500px"
      ><el-form label-width="70px"
        ><el-form-item label="编码"
          ><el-input
            v-model="permissionForm.code"
            :disabled="Boolean(editingPermission)" /></el-form-item
        ><el-form-item label="说明"
          ><el-input
            v-model="permissionForm.description"
            type="textarea" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="permissionDialog = false">取消</el-button
        ><el-button type="primary" @click="savePermission"
          >保存</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.permission-option {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.permission-option small {
  color: var(--el-text-color-secondary);
}
</style>
