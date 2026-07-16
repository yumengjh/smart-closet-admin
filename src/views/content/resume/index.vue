<script setup lang="ts">
import {
  getManagedResume,
  getResumeFeedback,
  parseResumeDocument,
  updateManagedResume,
  updateResumeFeedbackStatus,
  type ResumeDocument,
  type ResumeFeedback,
  type ResumeFeedbackStatus,
  type ResumeFeedbackType
} from "@/api/resume";
import { message } from "@/utils/message";
import { computed, onMounted, reactive, ref } from "vue";

defineOptions({ name: "ResumeManagement" });

const loading = ref(false), saving = ref(false), document = ref<ResumeDocument>(), editorText = ref(""), error = ref("");
const activeTab = ref("content");
const feedbackLoading = ref(false), feedbacks = ref<ResumeFeedback[]>([]), feedbackTotal = ref(0), feedbackLoaded = ref(false);
const feedbackQuery = reactive<{ page: number; size: number; type?: ResumeFeedbackType; status?: ResumeFeedbackStatus; rating?: number }>({ page: 0, size: 10 });
const summary = computed(() => { const content = document.value?.content; return content ? `${content.profile.name || "未填写姓名"} · ${content.sections.length} 个区块 · ${content.profile.contacts.length} 条联系方式` : ""; });
const feedbackSummary = computed(() => {
  const reviews = feedbacks.value.filter(item => item.type === "REVIEW" && item.rating);
  const average = reviews.length ? (reviews.reduce((total, item) => total + (item.rating || 0), 0) / reviews.length).toFixed(1) : "–";
  return `当前页 ${feedbacks.value.length} 条 · 评分均值 ${average} · 共 ${feedbackTotal.value} 条反馈`;
});
const format = () => { try { editorText.value = JSON.stringify(parseResumeDocument(editorText.value), null, 2); error.value = ""; } catch (cause) { error.value = cause instanceof Error ? cause.message : "简历内容格式错误"; } };
const load = async () => { loading.value = true; error.value = ""; try { document.value = await getManagedResume(); editorText.value = JSON.stringify(document.value.content, null, 2); } catch (cause) { error.value = cause instanceof Error ? cause.message : "简历内容加载失败"; } finally { loading.value = false; } };
const save = async () => { if (!document.value) return; try { saving.value = true; document.value = await updateManagedResume({ ...document.value, content: parseResumeDocument(editorText.value) }); editorText.value = JSON.stringify(document.value.content, null, 2); error.value = ""; message("简历已保存，公开页面刷新后即可看到更新", { type: "success" }); } catch (cause) { error.value = cause instanceof Error ? cause.message : "保存失败"; message(error.value, { type: "error" }); } finally { saving.value = false; } };
const loadFeedback = async () => { try { feedbackLoading.value = true; const page = await getResumeFeedback(feedbackQuery); feedbacks.value = page.items; feedbackTotal.value = page.totalElements; feedbackQuery.page = page.page; feedbackLoaded.value = true; } catch (cause) { message(cause instanceof Error ? cause.message : "反馈加载失败", { type: "error" }); } finally { feedbackLoading.value = false; } };
const changeFeedbackPage = (page: number) => { feedbackQuery.page = page - 1; loadFeedback(); };
const resetFeedbackFilters = () => { feedbackQuery.type = undefined; feedbackQuery.status = undefined; feedbackQuery.rating = undefined; feedbackQuery.page = 0; loadFeedback(); };
const changeFeedbackStatus = async (feedback: ResumeFeedback, status: ResumeFeedbackStatus) => { try { await updateResumeFeedbackStatus(feedback.id, status); feedback.status = status; message(status === "READ" ? "已标记为已读" : "已归档", { type: "success" }); } catch (cause) { message(cause instanceof Error ? cause.message : "更新失败", { type: "error" }); } };
const feedbackLabel = (feedback: ResumeFeedback) => feedback.type === "REACTION" ? ({ GREAT: "🤩 很喜欢", GOOD: "🙂 不错", NEUTRAL: "😐 一般", UNSURE: "🤔 有疑问", POOR: "😕 待改进" }[feedback.reaction || "NEUTRAL"]) : `${feedback.rating} 分`;
const statusLabel = (status: ResumeFeedbackStatus) => ({ UNREAD: "未读", READ: "已读", ARCHIVED: "已归档" }[status]);
const statusType = (status: ResumeFeedbackStatus) => status === "UNREAD" ? "danger" : status === "READ" ? "success" : "info";
const formatDate = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
const copySuggestion = async (value?: string) => { if (!value) return; try { await navigator.clipboard.writeText(value); message("建议已复制", { type: "success" }); } catch { message("复制失败，请手动选择文本", { type: "error" }); } };
const onTabChange = (tab: string | number) => { if (tab === "feedback" && !feedbackLoaded.value) loadFeedback(); };

onMounted(load);
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-base font-medium">简历管理</div>
            <div class="mt-1 text-sm text-gray-500">{{ activeTab === "content" ? (summary || "维护公开简历的所有内容") : feedbackSummary }}</div>
          </div>
          <div v-if="activeTab === 'content'" class="flex gap-2"><el-button :loading="loading" @click="load">重新加载</el-button><el-button @click="format">格式化内容</el-button><el-button type="primary" :loading="saving" @click="save">保存简历</el-button></div>
          <div v-else class="flex gap-2"><el-button :loading="feedbackLoading" @click="loadFeedback">刷新反馈</el-button></div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="简历内容" name="content">
          <el-alert class="mb-4" type="info" :closable="false" title="所有公开数据均在此编辑" description="可直接调整姓名、联系方式、区块标题、项目、经历、证书和链接；sections 支持 bullet-list、timeline、projects 与 custom 类型，新增内容无需修改数据库。" />
          <el-alert v-if="error" class="mb-4" type="error" :title="error" :closable="false" show-icon />
          <el-input v-model="editorText" v-loading="loading" type="textarea" :rows="30" resize="vertical" spellcheck="false" class="font-mono" placeholder="正在加载简历内容…" />
        </el-tab-pane>

        <el-tab-pane label="反馈" name="feedback">
          <el-alert class="mb-4" type="info" :closable="false" title="匿名反馈仅供内部改进" description="表情为即时阅读感受；评分与建议来自访客主动提交。IP 和浏览器信息仅向拥有简历管理权限的管理员展示。" />
          <div class="mb-4 flex flex-wrap gap-3">
            <el-select v-model="feedbackQuery.type" clearable placeholder="反馈类型" class="!w-32" @change="feedbackQuery.page = 0; loadFeedback()"><el-option label="阅读感受" value="REACTION" /><el-option label="评分建议" value="REVIEW" /></el-select>
            <el-select v-model="feedbackQuery.status" clearable placeholder="处理状态" class="!w-28" @change="feedbackQuery.page = 0; loadFeedback()"><el-option label="未读" value="UNREAD" /><el-option label="已读" value="READ" /><el-option label="已归档" value="ARCHIVED" /></el-select>
            <el-select v-model="feedbackQuery.rating" clearable placeholder="评分" class="!w-24" @change="feedbackQuery.page = 0; loadFeedback()"><el-option v-for="score in 5" :key="score" :label="`${score} 分`" :value="score" /></el-select>
            <el-button @click="resetFeedbackFilters">重置筛选</el-button>
          </div>
          <el-table v-loading="feedbackLoading" :data="feedbacks" border stripe>
            <el-table-column label="反馈" min-width="110"><template #default="{ row }"><span>{{ feedbackLabel(row) }}</span></template></el-table-column>
            <el-table-column label="建议" min-width="220"><template #default="{ row }"><span v-if="!row.suggestion" class="text-gray-400">未填写</span><div v-else class="flex items-center gap-2"><el-popover placement="top-start" :width="320" trigger="click"><template #reference><el-button link type="primary">查看建议</el-button></template><p class="whitespace-pre-wrap break-words leading-6">{{ row.suggestion }}</p></el-popover><el-button link @click="copySuggestion(row.suggestion)">复制</el-button></div></template></el-table-column>
            <el-table-column label="IP" prop="ipAddress" min-width="130" />
            <el-table-column label="提交时间" min-width="170"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
            <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="170" fixed="right"><template #default="{ row }"><el-button v-if="row.status === 'UNREAD'" link type="primary" @click="changeFeedbackStatus(row, 'READ')">标记已读</el-button><el-button v-if="row.status !== 'ARCHIVED'" link type="info" @click="changeFeedbackStatus(row, 'ARCHIVED')">归档</el-button></template></el-table-column>
          </el-table>
          <div class="mt-4 flex justify-end"><el-pagination background layout="total, prev, pager, next" :current-page="feedbackQuery.page + 1" :page-size="feedbackQuery.size" :total="feedbackTotal" @current-change="changeFeedbackPage" /></div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
