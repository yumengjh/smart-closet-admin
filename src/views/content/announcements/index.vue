<script setup lang="ts">
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  setAnnouncementPublication,
  updateAnnouncement,
  type Announcement
} from "@/api/announcements";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";
defineOptions({ name: "AnnouncementManagement" });
const { can } = useCurrentPermissions();
const rows = ref<Announcement[]>([]),
  loading = ref(false),
  dialog = ref(false),
  editing = ref<string>();
const page = ref(0),
  size = ref(20),
  total = ref(0);
const form = reactive({ title: "", content: "" });
const load = async () => {
  loading.value = true;
  try {
    const { data } = await listAnnouncements({
      page: page.value,
      size: size.value
    });
    rows.value = data.items;
    total.value = data.totalElements;
  } finally {
    loading.value = false;
  }
};
const open = (row?: Announcement) => {
  editing.value = row?.id;
  Object.assign(
    form,
    row
      ? { title: row.title, content: row.content }
      : { title: "", content: "" }
  );
  dialog.value = true;
};
const save = async () => {
  if (editing.value)
    await updateAnnouncement(editing.value, form.title, form.content);
  else await createAnnouncement(form.title, form.content);
  dialog.value = false;
  await load();
  message("公告已保存", { type: "success" });
};
const publish = async (row: Announcement) => {
  await setAnnouncementPublication(row.id, !row.published);
  await load();
};
const remove = async (row: Announcement) => {
  await ElMessageBox.confirm(`删除公告“${row.title}”？`, "删除公告", {
    type: "warning"
  });
  await deleteAnnouncement(row.id);
  await load();
};
const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  ""
);
const preview = (row: Announcement) =>
  window.open(
    `${apiBase}/announcements/${row.id}`,
    "_blank",
    "noopener,noreferrer"
  );
onMounted(load);
</script>
<template>
  <div class="page-root">
    <el-card shadow="never"
      ><template #header
        ><div class="flex flex-wrap items-center justify-between gap-3">
          <span>公告管理</span
          ><el-button
            v-if="can('example:announcement:write')"
            type="primary"
            @click="open()"
            >新建公告</el-button
          >
        </div></template
      ><el-table v-loading="loading" :data="rows"
        ><el-table-column
          prop="title"
          label="标题"
          min-width="220"
        /><el-table-column label="发布状态" width="120"
          ><template #default="{ row }"
            ><el-tag :type="row.published ? 'success' : 'info'">{{
              row.published ? "已发布" : "草稿"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="发布时间" min-width="180"
          ><template #default="{ row }">{{
            row.publishedAt ? new Date(row.publishedAt).toLocaleString() : "-"
          }}</template></el-table-column
        ><el-table-column label="操作" min-width="240" fixed="right"
          ><template #default="{ row }"
            ><el-button link @click="preview(row)">预览</el-button
            ><el-button
              v-if="can('example:announcement:write')"
              link
              type="primary"
              @click="open(row)"
              >编辑</el-button
            ><el-button
              v-if="can('example:announcement:write')"
              link
              :type="row.published ? 'warning' : 'success'"
              @click="publish(row)"
              >{{ row.published ? "撤回" : "发布" }}</el-button
            ><el-button
              v-if="can('example:announcement:delete')"
              link
              type="danger"
              @click="remove(row)"
              >删除</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:page-size="size"
          background
          layout="total, sizes, prev, pager, next"
          :current-page="page + 1"
          :total="total"
          @current-change="
            value => {
              page = value - 1;
              load();
            }
          "
          @size-change="
            value => {
              size = value;
              page = 0;
              load();
            }
          "
        /></div
    ></el-card>
    <el-dialog
      v-model="dialog"
      :title="editing ? '编辑公告' : '新建公告'"
      width="680px"
      ><el-form label-position="top"
        ><el-form-item label="标题"
          ><el-input
            v-model="form.title"
            maxlength="160"
            show-word-limit /></el-form-item
        ><el-form-item label="内容"
          ><el-input
            v-model="form.content"
            type="textarea"
            :rows="12"
            maxlength="20000"
            show-word-limit /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" @click="save">保存</el-button></template
      ></el-dialog
    >
  </div>
</template>
