<script setup lang="ts">
import { getManagedResume, parseResumeDocument, updateManagedResume, type ResumeDocument } from "@/api/resume";
import { message } from "@/utils/message";
import { computed, onMounted, ref } from "vue";
defineOptions({ name: "ResumeManagement" });
const loading = ref(false), saving = ref(false), document = ref<ResumeDocument>(), editorText = ref(""), error = ref("");
const summary = computed(() => { const content = document.value?.content; return content ? `${content.profile.name || "未填写姓名"} · ${content.sections.length} 个区块 · ${content.profile.contacts.length} 条联系方式` : ""; });
const format = () => { try { editorText.value = JSON.stringify(parseResumeDocument(editorText.value), null, 2); error.value = ""; } catch (cause) { error.value = cause instanceof Error ? cause.message : "简历内容格式错误"; } };
const load = async () => { loading.value = true; error.value = ""; try { document.value = await getManagedResume(); editorText.value = JSON.stringify(document.value.content, null, 2); } catch (cause) { error.value = cause instanceof Error ? cause.message : "简历内容加载失败"; } finally { loading.value = false; } };
const save = async () => { if (!document.value) return; try { saving.value = true; document.value = await updateManagedResume({ ...document.value, content: parseResumeDocument(editorText.value) }); editorText.value = JSON.stringify(document.value.content, null, 2); error.value = ""; message("简历已保存，公开页面刷新后即可看到更新", { type: "success" }); } catch (cause) { error.value = cause instanceof Error ? cause.message : "保存失败"; message(error.value, { type: "error" }); } finally { saving.value = false; } };
onMounted(load);
</script>
<template>
  <div class="page-root">
    <el-card v-loading="loading" shadow="never">
      <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><div class="text-base font-medium">简历管理</div><div class="mt-1 text-sm text-gray-500">{{ summary || "维护公开简历的所有内容" }}</div></div><div class="flex gap-2"><el-button :loading="loading" @click="load">重新加载</el-button><el-button @click="format">格式化内容</el-button><el-button type="primary" :loading="saving" @click="save">保存简历</el-button></div></div></template>
      <el-alert class="mb-4" type="info" :closable="false" title="所有公开数据均在此编辑" description="可直接调整姓名、联系方式、区块标题、项目、经历、证书和链接；sections 支持 bullet-list、timeline、projects 与 custom 类型，新增内容无需修改数据库。" />
      <el-alert v-if="error" class="mb-4" type="error" :title="error" :closable="false" show-icon />
      <el-input v-model="editorText" type="textarea" :rows="30" resize="vertical" spellcheck="false" class="font-mono" placeholder="正在加载简历内容…" />
    </el-card>
  </div>
</template>
