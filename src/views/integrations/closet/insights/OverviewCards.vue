<script setup lang="ts">
import type { InsightOverview } from "@/api/closet/insights";
import { number } from "./chartOptions";
import { percent } from "../useClosetRequest";
import WardrobeIcon from "~icons/ri/t-shirt-line";
import CheckIcon from "~icons/ri/check-double-line";
import OutfitIcon from "~icons/ri/sparkling-line";
import UserIcon from "~icons/ri/user-3-line";
defineProps<{ overview: InsightOverview }>();
</script>
<template>
  <el-card shadow="never">
    <div class="overview-strip">
      <div>
        <h3><WardrobeIcon />当前有效衣物</h3>
        <strong>{{ number(overview.garments.active) }}</strong>
        <p>区间新增 {{ number(overview.garments.createdInRange) }} 件</p>
      </div>
      <div>
        <h3><CheckIcon />衣物采纳率</h3>
        <strong>{{ percent(overview.garments.adoptionRate) }}</strong>
        <p>
          {{ number(overview.garments.adoptedInRange) }} /
          {{ number(overview.garments.createdInRange) }} 件
        </p>
      </div>
      <div>
        <h3><OutfitIcon />区间保存搭配</h3>
        <strong>{{ number(overview.outfits.createdInRange) }}</strong>
        <p>累计 {{ number(overview.outfits.total) }} 组</p>
      </div>
      <div v-if="overview.users">
        <h3><UserIcon />业务用户</h3>
        <strong
          >{{ number(overview.users.enabled) }}
          <small>/ {{ number(overview.users.total) }}</small></strong
        >
        <p>
          区间活跃 {{ number(overview.users.activeInRange) }} · 新增
          {{ number(overview.users.createdInRange) }}
        </p>
      </div>
    </div>
    <div class="overview-foot">
      <span
        >区间衣物草稿 <b>{{ number(overview.garments.draft) }}</b></span
      ><span
        >快速入柜
        <b>{{ number(overview.quickIntakes.createdInRange) }}</b></span
      ><span
        >搭配计划 <b>{{ number(overview.outfitPlans.createdInRange) }}</b></span
      ><span
        >图片用量 <b>{{ number(overview.ai.imageUnitsInRange) }}</b></span
      ><span
        >助手消息 <b>{{ number(overview.ai.agentMessagesInRange) }}</b></span
      >
    </div>
  </el-card>
</template>
<style scoped>
.overview-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.overview-strip > div {
  flex: 1;
  min-width: 160px;
}

h3 {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

h3 svg {
  font-size: 18px;
  color: var(--el-color-primary);
}

strong {
  display: block;
  margin: 10px 0 6px;
  font-size: 28px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

small {
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

p {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.overview-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-top: 16px;
  margin-top: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

b {
  margin-left: 8px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

@media (width <= 767px) {
  .overview-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 12px;
  }

  .overview-strip > div {
    min-width: 0;
  }

  p,
  .overview-foot {
    font-size: 14px;
  }

  strong {
    font-size: 24px;
  }
}
</style>
