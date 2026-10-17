<script setup lang="ts">
import {
  createMenu,
  deleteMenu,
  listMenus,
  setMenuEnabled,
  updateMenu,
  type MenuType,
  type NavigationMenu,
  type NavigationMenuPayload
} from "@/api/navigation";
import { initRouter } from "@/router/utils";
import { resetRouter } from "@/router";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../admin-code-presentation.mjs";

defineOptions({ name: "MenuManagement" });

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref<string>();
const formRef = ref<FormInstance>();
const menus = ref<NavigationMenu[]>([]);
const canWrite = computed(() =>
  useUserStoreHook().permissions.includes("system:menu:write")
);

const defaultForm = (): NavigationMenuPayload => ({
  parentId: null,
  code: "",
  title: "",
  routePath: "/",
  componentKey: "welcome",
  icon: "",
  sortOrder: 0,
  menuType: "PAGE",
  requiredPermission: null,
  visible: true,
  enabled: true,
  keepAlive: false
});
const form = reactive<NavigationMenuPayload>(defaultForm());

const rules: FormRules = {
  code: [
    { required: true, message: "请输入菜单编码", trigger: "blur" },
    {
      pattern: /^[a-z][a-z0-9-]{1,99}$/,
      message: "仅小写字母、数字与连字符",
      trigger: "blur"
    }
  ],
  title: [{ required: true, message: "请输入菜单名称", trigger: "blur" }],
  routePath: [
    { required: true, message: "请输入路由路径", trigger: "blur" },
    {
      pattern: /^\/[A-Za-z0-9/_-]*$/,
      message: "必须为内部绝对路径",
      trigger: "blur"
    }
  ],
  componentKey: [
    {
      validator: (_rule, value, callback) =>
        form.menuType === "DIRECTORY" || value
          ? callback()
          : callback(new Error("请选择组件键")),
      trigger: "change"
    }
  ]
};

const parentOptions = computed(() => {
  const result: NavigationMenu[] = [];
  const walk = (items: NavigationMenu[]) =>
    items.forEach(item => {
      if (item.menuType === "DIRECTORY") result.push(item);
      walk(item.children);
    });
  walk(menus.value);
  return result;
});

function normalizePayload(): NavigationMenuPayload {
  return {
    ...form,
    parentId: form.parentId || null,
    componentKey: form.menuType === "DIRECTORY" ? null : form.componentKey,
    icon: form.icon || null,
    requiredPermission: form.requiredPermission || null
  };
}

async function load() {
  loading.value = true;
  try {
    menus.value = (await listMenus()).data;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = undefined;
  Object.assign(form, defaultForm());
  dialogVisible.value = true;
}

function openEdit(row: NavigationMenu) {
  editingId.value = row.id;
  Object.assign(form, {
    parentId: row.parentId,
    code: row.code,
    title: row.title,
    routePath: row.routePath,
    componentKey: row.componentKey,
    icon: row.icon || "",
    sortOrder: row.sortOrder,
    menuType: row.menuType,
    requiredPermission: row.requiredPermission,
    visible: row.visible,
    enabled: row.enabled,
    keepAlive: row.keepAlive
  });
  dialogVisible.value = true;
}

async function refreshPermissions() {
  await useUserStoreHook().loadProfile();
  message("权限信息已刷新", { type: "success" });
}

function menuTypeChanged(type: MenuType) {
  if (type === "DIRECTORY") form.componentKey = null;
  else if (!form.componentKey) form.componentKey = "welcome";
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload = normalizePayload();
    if (editingId.value) await updateMenu(editingId.value, payload);
    else await createMenu(payload);
    dialogVisible.value = false;
    await reloadNavigation();
    message("菜单已保存", { type: "success" });
  } finally {
    saving.value = false;
  }
}

async function remove(row: NavigationMenu) {
  await ElMessageBox.confirm(`确认删除菜单“${row.title}”吗？`, "删除菜单", {
    type: "warning"
  });
  await deleteMenu(row.id);
  await reloadNavigation();
  message("菜单已删除", { type: "success" });
}

async function toggleEnabled(row: NavigationMenu) {
  const enabled = !row.enabled;
  const action = enabled ? "启用" : "停用";
  await ElMessageBox.confirm(
    enabled
      ? `确认启用菜单“${row.title}”吗？`
      : `确认停用菜单“${row.title}”吗？停用目录会同时隐藏其下所有菜单。`,
    `${action}菜单`,
    { type: "warning", confirmButtonText: action, cancelButtonText: "取消" }
  );
  await setMenuEnabled(row.id, enabled);
  await reloadNavigation();
  message(`菜单已${action}`, { type: "success" });
}

async function reloadNavigation() {
  await load();
  resetRouter();
  await initRouter();
}

onMounted(async () => {
  await useUserStoreHook()
    .loadProfile()
    .catch(() => undefined);
  await load();
});
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>菜单管理</span>
          <el-button v-if="canWrite" type="primary" @click="openCreate"
            >新增菜单</el-button
          >
        </div>
      </template>
      <el-alert
        v-if="!canWrite"
        class="mb-4"
        title="当前登录态没有菜单管理权限"
        type="warning"
        :closable="false"
        description="需要 system:menu:write 才能新增、编辑或删除菜单。若刚调整过角色权限，可刷新权限信息；仍无权限时请重新登录或由超级管理员授予该权限。"
      >
        <template #default>
          <el-button link type="primary" @click="refreshPermissions"
            >刷新权限信息</el-button
          >
        </template>
      </el-alert>
      <el-table :data="menus" row-key="id" default-expand-all>
        <el-table-column prop="title" label="菜单名称" min-width="160" />
        <el-table-column prop="code" label="编码" min-width="150" />
        <el-table-column prop="routePath" label="路由路径" min-width="180" />
        <el-table-column label="组件键" min-width="150">
          <template #default="{ row }">
            <el-tooltip
              :content="
                adminCodeTooltip('navigationComponent', row.componentKey)
              "
              >{{
                adminCodeLabel("navigationComponent", row.componentKey)
              }}</el-tooltip
            >
          </template>
        </el-table-column>
        <el-table-column label="访问权限" min-width="220">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.requiredPermission"
              :content="adminCodeTooltip('permission', row.requiredPermission)"
              >{{
                adminCodeLabel("permission", row.requiredPermission)
              }}</el-tooltip
            >
            <span v-else>所有已登录用户</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{
              row.enabled ? "启用" : "停用"
            }}</el-tag>
            <el-tag
              v-if="row.systemManaged"
              class="ml-1"
              type="warning"
              size="small"
              >内置</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canWrite"
              link
              :type="row.enabled ? 'warning' : 'success'"
              @click="toggleEnabled(row)"
              >{{ row.enabled ? "停用" : "启用" }}</el-button
            >
            <el-button
              v-if="canWrite && !row.systemManaged"
              link
              type="primary"
              @click="openEdit(row)"
              >编辑</el-button
            >
            <el-button
              v-if="canWrite && !row.systemManaged"
              link
              type="danger"
              @click="remove(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="父级菜单" prop="parentId">
          <el-select
            v-model="form.parentId"
            clearable
            filterable
            class="w-full"
            placeholder="顶级菜单"
          >
            <el-option
              v-for="item in parentOptions.filter(
                item => item.id !== editingId
              )"
              :key="item.id"
              :label="item.title"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单编码" prop="code"
          ><el-input v-model="form.code" :disabled="Boolean(editingId)"
        /></el-form-item>
        <el-form-item label="菜单名称" prop="title"
          ><el-input v-model="form.title"
        /></el-form-item>
        <el-form-item label="菜单类型"
          ><el-radio-group v-model="form.menuType" @change="menuTypeChanged"
            ><el-radio-button value="PAGE">页面</el-radio-button
            ><el-radio-button value="DIRECTORY"
              >目录</el-radio-button
            ></el-radio-group
          ></el-form-item
        >
        <el-form-item label="路由路径" prop="routePath"
          ><el-input v-model="form.routePath" placeholder="/system/menu"
        /></el-form-item>
        <el-form-item
          v-if="form.menuType === 'PAGE'"
          label="组件键"
          prop="componentKey"
          ><el-select v-model="form.componentKey" class="w-full"
            ><el-option label="首页" value="welcome" /><el-option
              label="权限页"
              value="permission-page" /><el-option
              label="菜单管理"
              value="menu-management" /><el-option
              label="用户管理"
              value="user-management" /><el-option
              label="角色与权限"
              value="rbac-management" /><el-option
              label="运行配置"
              value="runtime-config" /><el-option
              label="IP 访问规则"
              value="ip-rule-management" /><el-option
              label="审计日志"
              value="audit-log" /><el-option
              label="公告管理"
              value="announcement-management" /><el-option
              label="简历管理"
              value="resume-management" /><el-option
              label="账户安全"
              value="account-security" />
            <el-option label="鱼搭业务用户" value="closet-users" />
            <el-option label="衣柜洞察" value="closet-insights" />
            <el-option label="业务大屏" value="closet-dashboard" />
            <el-option label="运行监控" value="closet-ops" />
            <el-option label="数据导出" value="closet-exports" />
            <el-option label="模板审核" value="closet-templates" /></el-select
        ></el-form-item>
        <el-form-item label="图标"
          ><el-input v-model="form.icon" placeholder="例如 ri/menu-line"
        /></el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="form.sortOrder" :min="0"
        /></el-form-item>
        <el-form-item label="访问权限"
          ><el-input
            v-model="form.requiredPermission"
            placeholder="例如 system:menu:read；留空表示已登录可见"
        /></el-form-item>
        <el-form-item label="选项"
          ><el-checkbox v-model="form.visible">显示</el-checkbox
          ><el-checkbox v-model="form.enabled">启用</el-checkbox
          ><el-checkbox v-model="form.keepAlive"
            >缓存页面</el-checkbox
          ></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button @click="dialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
