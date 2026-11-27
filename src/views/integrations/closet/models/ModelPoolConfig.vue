<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { http } from "@/utils/http";
import { message } from "@/utils/message";
import type { ApiResponse } from "@/api/user";
import type { ModelOverview } from "@/api/closet/models";

type PoolName = "VISION" | "CHAT" | "IMAGE_PREMIUM" | "IMAGE_STANDARD" | "PORTRAIT_PREMIUM" | "PORTRAIT_STANDARD";
type Member = { entryId: string; label: string | null; providerId: string | null; model: string | null; priority: number; weight: number; enabled: boolean; drain: boolean; maxConcurrency: number; dailyCallCap: number; dailySpendCapMicro: number | null; spendCurrency: string | null; paidProbeIntervalMinutes: number | null; inFlight: number; today: { calls: number; spend: { currency: string; amountMicro: number }[] }; unavailable: string | null };
type Pool = { pool: PoolName; capability: string; configured: boolean; revision: number; members: Member[] };
type Tiers = { degradeEnabled: boolean; cleanupPool: "IMAGE_PREMIUM" | "IMAGE_STANDARD"; units: { vision: number; cleanup: number; renderStandard: number; renderPremium: number }; defaultRenderTier: "PREMIUM" | "STANDARD"; renderTiersEnabled: boolean; revision: number };
type Resend = { enabled: boolean; maxAttempts: number; fast503Ms: number; notExecutedMarkers: string[]; builtInMarkers: string[]; revision: number };
type Extra = { pools: Pool[]; tiers: Tiers; resend: Resend };
type MemberForm = { entryId: string; priority: number; weight: number; enabled: boolean; drain: boolean; maxConcurrency: number; dailyCallCap: number; dailySpendCap: number | undefined; spendCurrency: string; paidProbeIntervalMinutes: number | undefined };
const props = defineProps<{ overview: ModelOverview; writable: boolean }>();
const emit = defineEmits<{ refresh: [] }>();
const pools = ref<Pool[]>([]);
const tiers = ref<Tiers>();
const resend = ref<Resend>();
watch(() => props.overview, value => {
  const data = value as ModelOverview & Extra;
  pools.value = data.pools;
  tiers.value = structuredClone(data.tiers);
  resend.value = structuredClone(data.resend);
}, { immediate: true });
const names: Record<PoolName, string> = { VISION: "识图", CHAT: "对话", IMAGE_PREMIUM: "生图·高质量", IMAGE_STANDARD: "生图·标准", PORTRAIT_PREMIUM: "形象图·高质量", PORTRAIT_STANDARD: "形象图·标准" };
const reasons: Record<string, string> = { DISABLED: "已关闭", DRAINED: "已摘除", MISSING: "模型已删除", UNUSABLE: "服务商密钥不可用", UNREACHABLE: "探活连不上", LOW_BALANCE: "余额不足已移出", PAUSED: "连续失败暂停中", CONCURRENCY: "并发已满", CALL_CAP: "今日调用已达上限", SPEND_CAP: "今日花费已达上限" };
const name = (m: Member) => `${m.label || m.model || m.entryId} · ${props.overview.providers.find(p => p.id === m.providerId)?.name || m.providerId || "服务商已删除"}`;
const status = (m: Member) => {
  if (m.unavailable === "DRAINED") return "已摘除";
  if (m.unavailable === "PAUSED") {
    const until = props.overview.entries.find(e => e.id === m.entryId)?.health?.pausedUntilMs;
    return until ? `暂停到 ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "不可用：连续失败暂停中";
  }
  return m.unavailable ? `不可用：${reasons[m.unavailable] || m.unavailable}` : "正常";
};
const money = (n: number, currency: string) => `${(n / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${currency}`;
const root = "/closet/models";
const busy = ref(false);
async function act(action: () => Promise<unknown>, conflict = "这条配置刚被改过，请刷新后再改") {
  if (busy.value || !props.writable) return false;
  busy.value = true;
  try { await action(); message("操作成功", { type: "success" }); emit("refresh"); return true; }
  catch (error) { const response = (error as { response?: { status?: number; data?: { message?: string } } }).response; message(response?.status === 409 ? conflict : response?.data?.message || "操作失败，请重试", { type: "error" }); return false; }
  finally { busy.value = false; }
}
async function confirm(text: string, title: string) {
  try { await ElMessageBox.confirm(text, title, { type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" }); return true; } catch { return false; }
}
const editing = ref<Pool>();
const open = ref(false);
const members = ref<MemberForm[]>([]);
function edit(pool: Pool) {
  editing.value = pool;
  members.value = pool.configured ? pool.members.map(m => ({ entryId: m.entryId, priority: m.priority, weight: m.weight, enabled: m.enabled, drain: m.drain, maxConcurrency: m.maxConcurrency, dailyCallCap: m.dailyCallCap, dailySpendCap: m.dailySpendCapMicro == null ? undefined : m.dailySpendCapMicro / 1000000, spendCurrency: m.spendCurrency || "CNY", paidProbeIntervalMinutes: m.paidProbeIntervalMinutes ?? undefined })) : [];
  open.value = true;
}
function add() { members.value.push({ entryId: "", priority: 1, weight: 100, enabled: true, drain: false, maxConcurrency: 0, dailyCallCap: 0, dailySpendCap: undefined, spendCurrency: "CNY", paidProbeIntervalMinutes: undefined }); }
async function savePool() {
  const pool = editing.value;
  if (!pool) return;
  if (!members.value.length || members.value.some(m => !m.entryId || (m.dailySpendCap != null && !/^[A-Z]{3}$/.test(m.spendCurrency))) || new Set(members.value.map(m => m.entryId)).size !== members.value.length) { message("请选择不重复的模型，并为花费上限填写三位币种", { type: "warning" }); return; }
  const data = { members: members.value.map(({ dailySpendCap, ...m }) => ({ ...m, maxConcurrency: pool.pool === "CHAT" ? 0 : m.maxConcurrency, dailySpendCapMicro: dailySpendCap == null ? null : Math.round(dailySpendCap * 1000000), spendCurrency: dailySpendCap == null ? null : m.spendCurrency, paidProbeIntervalMinutes: m.paidProbeIntervalMinutes ?? null })), ...(pool.configured ? { revision: pool.revision } : {}) };
  if (await act(() => http.request("put", `${root}/pools/${pool.pool}`, { data }), "这个池刚被改过，请刷新后再改")) open.value = false;
}
async function clear(pool: Pool) { if (await confirm("清空后：识图、对话、生图·高质量回到部署默认模型；其他池不再提供。形象图跟随同档生图池。", "清空模型池")) await act(() => http.request("delete", `${root}/pools/${pool.pool}`)); }
async function memberAction(m: Member, action: "drain" | "undrain" | "resume" | "probe-paid") {
  if (action === "probe-paid" && !(await confirm("会产生一次真实调用费用，确定付费探活？", "付费探活"))) return;
  const id = encodeURIComponent(m.entryId);
  if (action === "probe-paid") {
    await act(async () => { const result = await http.request<ApiResponse<{ sent: boolean; ok: boolean; code: string | null; costMicro: number | null; costCurrency: string | null; skipped: string | null }>>("post", `${root}/entries/${id}/${action}`, { timeout: 190000 }); const r = result.data; await ElMessageBox.alert(r.sent ? `${r.ok ? "探活成功" : "探活失败"}：${r.code || "—"}，费用 ${r.costMicro == null ? "未返回" : money(r.costMicro, r.costCurrency || "未知币种")}` : `未发送：${r.skipped || r.code || "未知原因"}`, "付费探活结果"); });
  } else await act(() => http.request("post", `${root}/entries/${id}/${action}`));
}
async function saveTiers() { if (!tiers.value) return; const { renderTiersEnabled: _enabled, ...data } = tiers.value; await act(() => http.request("put", `${root}/tiers`, { data })); }
async function saveResend() { if (!resend.value) return; const { builtInMarkers: _builtIn, ...data } = resend.value; await act(() => http.request("put", `${root}/resend`, { data })); }
const marker = ref("");
function addMarker() { const value = marker.value.trim(); if (value && resend.value && !resend.value.notExecutedMarkers.includes(value)) resend.value.notExecutedMarkers.push(value); marker.value = ""; }
</script>

<template>
  <el-card>
    <template #header><div><h2 class="text-base">模型池</h2><p class="text-xs text-gray-500">同一用途可以放多家模型：数字小的优先级先用，同一优先级按权重分流；某家连续失败会暂停 10 分钟，期间由其他成员接手。没配池的用途使用部署默认模型。</p></div></template>
    <section v-for="pool in pools" :key="pool.pool" class="space-y-2 mb-6">
      <div class="flex items-center justify-between"><h3 class="font-medium">{{ names[pool.pool] }}</h3><div><el-button :disabled="!writable || busy" @click="edit(pool)">编辑池</el-button><el-button :disabled="!writable || busy || !pool.configured" @click="clear(pool)">清空池</el-button></div></div>
      <p v-if="!pool.configured" class="text-xs text-gray-500">{{ pool.pool.startsWith('PORTRAIT') ? '未单独配置，跟随同档生图池' : pool.pool === 'IMAGE_STANDARD' ? '未配置标准档：用户端不显示标准 / 高质量选择' : '未配置，使用部署默认模型' }}</p>
      <el-table v-if="pool.configured" :data="pool.members">
        <el-table-column label="模型" min-width="160"><template #default="{ row }">{{ name(row) }}</template></el-table-column>
        <el-table-column prop="priority" label="优先级" width="80" /><el-table-column prop="weight" label="权重" width="70" />
        <el-table-column label="在途 / 并发上限" min-width="130"><template #default="{ row }">{{ row.inFlight }} / {{ row.maxConcurrency || '不限' }}</template></el-table-column>
        <el-table-column label="今日调用 / 上限" min-width="130"><template #default="{ row }">{{ row.today.calls }} / {{ row.dailyCallCap || '不限' }}</template></el-table-column>
        <el-table-column label="今日花费 / 上限" min-width="160"><template #default="{ row }">{{ row.today.spend.map(s => money(s.amountMicro, s.currency)).join('、') || '无花费' }} / {{ row.dailySpendCapMicro == null ? '不限' : money(row.dailySpendCapMicro, row.spendCurrency) }}</template></el-table-column>
        <el-table-column label="状态" min-width="150"><template #default="{ row }">{{ status(row) }}</template></el-table-column>
        <el-table-column label="操作" min-width="230" fixed="right"><template #default="{ row }"><el-button link type="primary" :disabled="!writable || busy" @click="edit(pool)">编辑</el-button><el-button link type="primary" :disabled="!writable || busy" @click="memberAction(row, row.drain ? 'undrain' : 'drain')">{{ row.drain ? '放回' : '摘除' }}</el-button><el-button link type="primary" :disabled="!writable || busy" @click="memberAction(row, 'resume')">恢复</el-button><el-button link type="primary" :disabled="!writable || busy" @click="memberAction(row, 'probe-paid')">付费探活</el-button></template></el-table-column>
      </el-table>
    </section>
  </el-card>
  <el-card v-if="tiers"><template #header><div><h2 class="text-base">档位与降级</h2><p class="text-xs text-gray-500">用户在做张图里选标准或高质量。高质量池里没有可用模型时，自动改用标准完成并告诉用户，只扣标准的次数。</p></div></template>
    <el-form label-position="top"><el-form-item label="允许降级"><el-switch v-model="tiers.degradeEnabled" :disabled="!writable" /></el-form-item><el-form-item label="衣物整理用哪个池"><el-radio-group v-model="tiers.cleanupPool" :disabled="!writable"><el-radio value="IMAGE_PREMIUM">高质量</el-radio><el-radio value="IMAGE_STANDARD">标准</el-radio></el-radio-group></el-form-item>
      <el-form-item v-for="item in ([['vision','识图'],['cleanup','整理'],['renderStandard','标准做张图'],['renderPremium','高质量做张图']] as const)" :key="item[0]" :label="`${item[1]}每次扣几次`"><el-input-number v-model="tiers.units[item[0]]" :min="0" :max="20" step-strictly :disabled="!writable" /></el-form-item>
      <el-form-item label="新用户默认档位"><el-radio-group v-model="tiers.defaultRenderTier" :disabled="!writable"><el-radio value="STANDARD">标准</el-radio><el-radio value="PREMIUM">高质量</el-radio></el-radio-group></el-form-item><el-button type="primary" :disabled="!writable || busy" @click="saveTiers">保存</el-button></el-form>
  </el-card>
  <el-card v-if="resend"><template #header><div><h2 class="text-base">换家重发</h2><p class="text-xs text-gray-500">只有确定上游没执行的失败（连不上、密钥被拒、限流、很快返回的 503、中转说没有可用渠道）才会在同一个任务里马上换一家；超时、504 这类可能已经扣费的失败不会重发，避免付两次钱。</p></div></template>
    <el-form label-position="top"><el-form-item label="开启"><el-switch v-model="resend.enabled" :disabled="!writable" /></el-form-item><el-form-item label="最多换几家"><el-input-number v-model="resend.maxAttempts" :min="0" :max="5" step-strictly :disabled="!writable" /></el-form-item><el-form-item label="很快返回的 503 时限（毫秒）"><el-input-number v-model="resend.fast503Ms" :min="0" :max="60000" step-strictly :disabled="!writable" /></el-form-item><el-form-item label="内置标记"><span>{{ resend.builtInMarkers.join('、') || '无' }}</span></el-form-item><el-form-item label="自加标记"><el-tag v-for="item in resend.notExecutedMarkers" :key="item" :closable="writable" class="mr-2" @close="resend.notExecutedMarkers = resend.notExecutedMarkers.filter(x => x !== item)">{{ item }}</el-tag><el-input v-model="marker" maxlength="80" style="width: 220px" :disabled="!writable" @keydown.enter.prevent="addMarker" /><el-button :disabled="!writable || resend.notExecutedMarkers.length >= 30" @click="addMarker">添加</el-button></el-form-item><el-button type="primary" :disabled="!writable || busy" @click="saveResend">保存</el-button></el-form>
  </el-card>
  <el-dialog v-model="open" :title="`编辑模型池：${editing ? names[editing.pool] : ''}`" width="min(1000px, 95vw)">
    <p v-if="editing?.pool === 'CHAT'" class="text-xs text-gray-500">对话模型暂不支持并发上限</p><p class="text-xs text-gray-500">并发和调用上限填 0 表示不限；花费上限留空表示不限，定时付费探活间隔留空不开。</p>
    <div v-for="(member, index) in members" :key="index" class="space-y-2 border-b py-3">
      <el-select v-model="member.entryId" placeholder="选择模型"><el-option v-for="entry in overview.entries.filter(e => e.capability === editing?.capability)" :key="entry.id" :value="entry.id" :label="`${entry.label || entry.model} · ${overview.providers.find(p => p.id === entry.providerId)?.name || entry.providerId}`" /></el-select>
      <el-button type="danger" link @click="members.splice(index, 1)">删除成员</el-button>
      <el-form label-position="top" inline><el-form-item label="优先级"><el-input-number v-model="member.priority" :min="1" :max="9" step-strictly /></el-form-item><el-form-item label="权重"><el-input-number v-model="member.weight" :min="1" :max="100" step-strictly /></el-form-item><el-form-item label="开启"><el-switch v-model="member.enabled" /></el-form-item><el-form-item v-if="editing?.pool !== 'CHAT'" label="并发上限"><el-input-number v-model="member.maxConcurrency" :min="0" :max="1000" step-strictly /></el-form-item><el-form-item label="每日调用上限"><el-input-number v-model="member.dailyCallCap" :min="0" :max="10000000" step-strictly /></el-form-item><el-form-item label="每日花费上限"><el-input-number v-model="member.dailySpendCap" :min="0" :precision="6" /></el-form-item><el-form-item label="币种"><el-input v-model="member.spendCurrency" maxlength="3" style="width: 90px" /></el-form-item><el-form-item label="定时付费探活间隔（分钟）"><el-input-number v-model="member.paidProbeIntervalMinutes" :min="30" :max="1440" step-strictly /></el-form-item></el-form>
    </div><el-button :disabled="members.length >= 20" @click="add">添加成员</el-button>
    <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" :loading="busy" @click="savePool">保存</el-button></template>
  </el-dialog>
</template>
