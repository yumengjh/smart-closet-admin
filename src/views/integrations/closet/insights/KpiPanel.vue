<script setup lang="ts">
import { computed, ref } from "vue";
import type { RecommendationKpi, AiUsage } from "@/api/closet/insights";
import { percent } from "../useClosetRequest";
import {
  lineChart,
  donutChart,
  barChart,
  number,
  featureLabel,
  sourceLabel
} from "./chartOptions";
import ChartView from "./ChartView.vue";
import SparkleIcon from "~icons/ri/sparkling-line";
import CpuIcon from "~icons/ri/cpu-line";
const props = defineProps<{
  recommendations: RecommendationKpi;
  ai: AiUsage;
}>();
const breakdown = ref("source");
const trend = computed(() =>
  lineChart(
    props.recommendations.daily.map(row => row.date.slice(5)),
    [
      {
        name: "展示",
        values: props.recommendations.daily.map(row => row.shown)
      },
      {
        name: "采用",
        values: props.recommendations.daily.map(row => row.adopted)
      }
    ]
  )
);
const groups = computed(() => [
  {
    label: "来源",
    key: "source",
    rows: props.recommendations.bySource,
    names: props.recommendations.bySource.map(row => sourceLabel(row.source))
  },
  {
    label: "排序",
    key: "rank",
    rows: props.recommendations.byRank,
    names: props.recommendations.byRank.map(row => `第 ${row.rank} 位`)
  },
  {
    label: "模板",
    key: "template",
    rows: props.recommendations.templates,
    names: props.recommendations.templates.map(row => row.template)
  }
]);
const selectedGroup = computed(
  () =>
    groups.value.find(group => group.key === breakdown.value) ?? groups.value[0]
);
const sourceChart = computed(() =>
  barChart(selectedGroup.value.names, [
    { name: "展示", values: selectedGroup.value.rows.map(row => row.shown) },
    { name: "采用", values: selectedGroup.value.rows.map(row => row.adopted) }
  ])
);
const features = computed(() =>
  barChart(
    props.ai.byFeature.map(row => featureLabel(row.feature)),
    [
      {
        name: "输入 Token",
        values: props.ai.byFeature.map(row => row.inputTokens)
      },
      {
        name: "输出 Token",
        values: props.ai.byFeature.map(row => row.outputTokens)
      }
    ],
    true
  )
);
const zeroModel = computed(() =>
  donutChart(
    [
      { name: "零模型推荐", value: props.ai.recommendations.zeroModel },
      {
        name: "使用模型",
        value: Math.max(
          0,
          props.ai.recommendations.total - props.ai.recommendations.zeroModel
        )
      }
    ],
    "零模型推荐占比",
    percent(props.ai.recommendations.zeroModelRatio)
  )
);
</script>
<template>
  <el-card shadow="never">
    <template #header
      ><div class="chart-heading">
        <div>
          <h3 class="flex items-center gap-2">
            <SparkleIcon class="text-lg" />推荐效果
          </h3>
          <p>从推荐展示到采用，观察真实转化</p>
        </div>
        <el-tag effect="plain"
          >采用率 {{ percent(recommendations.adoptionRate) }}</el-tag
        >
      </div></template
    >
    <div class="analytics-summary">
      <div>
        <strong>{{ number(recommendations.shown) }}</strong
        ><span>展示套数</span>
      </div>
      <div>
        <strong>{{ number(recommendations.adopted) }}</strong
        ><span>采用套数</span>
      </div>
      <div>
        <strong>{{ percent(recommendations.likeRate) }}</strong
        ><span>点赞率</span>
      </div>
    </div>
    <div class="analytics-chart-grid">
      <div>
        <div class="chart-heading"><h3>每日展示与采用</h3></div>
        <ChartView :option="trend" :height="290" />
      </div>
      <div>
        <div class="chart-heading">
          <h3>效果分布</h3>
          <el-radio-group
            v-model="breakdown"
            size="small"
            aria-label="推荐效果分组"
            ><el-radio-button
              v-for="group in groups"
              :key="group.key"
              :value="group.key"
              >{{ group.label }}</el-radio-button
            ></el-radio-group
          >
        </div>
        <ChartView
          v-if="selectedGroup.rows.length"
          :option="sourceChart"
          :height="290"
        /><el-empty
          v-else
          description="当前范围暂无推荐记录"
          :image-size="70"
        />
      </div>
    </div>
    <div class="recommendation-feedback">
      <span
        >点赞 <b>{{ number(recommendations.liked) }}</b></span
      ><span
        >点踩 <b>{{ number(recommendations.disliked) }}</b></span
      ><span
        >在搭台打开 <b>{{ number(recommendations.openedInWorkspace) }}</b></span
      ><span
        >三天内穿过 <b>{{ number(recommendations.wornWithin3Days) }}</b></span
      ><span
        >换一件 <b>{{ number(recommendations.swaps) }}</b></span
      ><span
        >参与用户 <b>{{ number(recommendations.users) }}</b></span
      >
    </div>
    <el-collapse class="analytics-detail"
      ><el-collapse-item title="查看明细与统计口径" name="recommendation-detail"
        ><p class="analytics-note mb-3">{{ recommendations.definition }}</p>
        <el-table :data="selectedGroup.rows"
          ><el-table-column
            :prop="selectedGroup.key"
            :label="selectedGroup.label"
            min-width="160"
          /><el-table-column prop="shown" label="展示" /><el-table-column
            prop="adopted"
            label="采用"
          /><el-table-column label="采用率"
            ><template #default="{ row }">{{
              percent(row.adoptionRate)
            }}</template></el-table-column
          ></el-table
        ></el-collapse-item
      ></el-collapse
    >
  </el-card>
  <el-card shadow="never">
    <template #header
      ><div class="chart-heading">
        <div>
          <h3 class="flex items-center gap-2">
            <CpuIcon class="text-lg" />AI 资源用量
          </h3>
          <p>按功能比较消耗，关注推荐的模型依赖</p>
        </div>
        <el-tag type="success" effect="plain"
          >{{ number(ai.recommendations.zeroModel) }} 次零模型推荐</el-tag
        >
      </div></template
    >
    <div class="analytics-summary">
      <div>
        <strong>{{ number(ai.totals.calls) }}</strong
        ><span>模型调用</span>
      </div>
      <div>
        <strong>{{ number(ai.totals.inputTokens) }}</strong
        ><span>输入 Token</span>
      </div>
      <div>
        <strong>{{ number(ai.totals.outputTokens) }}</strong
        ><span>输出 Token</span>
      </div>
    </div>
    <div class="analytics-chart-grid">
      <div>
        <div class="chart-heading"><h3>各功能 Token 消耗</h3></div>
        <ChartView
          v-if="ai.byFeature.length"
          :option="features"
          :height="280"
        /><el-empty
          v-else
          description="当前范围暂无模型调用"
          :image-size="70"
        />
      </div>
      <div><ChartView :option="zeroModel" :height="280" /></div>
    </div>
    <p class="analytics-note">
      图片用量 {{ number(ai.imageUnits) }} · 助手消息
      {{ number(ai.agentMessages) }}。{{ ai.note }}
    </p>
    <el-collapse class="analytics-detail"
      ><el-collapse-item title="查看功能调用明细" name="ai-detail"
        ><el-table :data="ai.byFeature"
          ><el-table-column
            prop="feature"
            label="功能"
            min-width="150" /><el-table-column
            prop="calls"
            label="调用" /><el-table-column
            prop="inputTokens"
            label="输入 Token" /><el-table-column
            prop="outputTokens"
            label="输出 Token" /><el-table-column
            prop="unknownUsage"
            label="用量未知" /></el-table></el-collapse-item
      ><el-collapse-item
        v-if="ai.topUsers?.length"
        title="用量最高的业务用户"
        name="ai-users"
        ><el-table :data="ai.topUsers"
          ><el-table-column prop="username" label="用户" /><el-table-column
            prop="calls"
            label="调用" /><el-table-column
            prop="tokens"
            label="Token" /></el-table></el-collapse-item
    ></el-collapse>
  </el-card>
</template>
<style scoped>
.recommendation-feedback {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-top: 18px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.recommendation-feedback b {
  margin-left: 6px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

@media (width <= 767px) {
  .recommendation-feedback {
    font-size: 14px;
  }
}
</style>
