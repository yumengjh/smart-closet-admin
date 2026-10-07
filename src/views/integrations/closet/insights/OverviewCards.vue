<script setup lang="ts">
import type { InsightOverview } from "@/api/closet/insights";
defineProps<{ overview: InsightOverview }>();
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <el-card shadow="never"
      ><div class="text-sm text-gray-500">当前有效衣物</div>
      <div class="mt-2 text-2xl font-semibold">
        {{ overview.garments.active }}
      </div>
      <div class="mt-1 text-sm">
        区间新增 {{ overview.garments.createdInRange }} 件
      </div></el-card
    >
    <el-card shadow="never"
      ><div class="text-sm text-gray-500">区间采纳</div>
      <div class="mt-2 text-2xl font-semibold">
        {{
          overview.garments.adoptionRate == null
            ? "暂无"
            : `${(overview.garments.adoptionRate * 100).toFixed(1)}%`
        }}
      </div>
      <div class="mt-1 text-sm">
        {{ overview.garments.adoptedInRange }} /
        {{ overview.garments.createdInRange }} 件
      </div></el-card
    >
    <el-card shadow="never"
      ><div class="text-sm text-gray-500">区间保存搭配</div>
      <div class="mt-2 text-2xl font-semibold">
        {{ overview.outfits.createdInRange }}
      </div>
      <div class="mt-1 text-sm">
        累计 {{ overview.outfits.total }} 组
      </div></el-card
    >
    <el-card shadow="never"
      ><div class="text-sm text-gray-500">AI 使用量</div>
      <div class="mt-2 text-2xl font-semibold">
        {{ overview.ai.imageUnitsInRange + overview.ai.agentMessagesInRange }}
      </div>
      <div class="mt-1 text-sm">
        图片 {{ overview.ai.imageUnitsInRange }} · Agent
        {{ overview.ai.agentMessagesInRange }}
      </div></el-card
    >
    <el-card v-if="overview.users" shadow="never"
      ><div class="text-sm text-gray-500">业务用户</div>
      <div class="mt-2 text-2xl font-semibold">
        {{ overview.users.enabled }} / {{ overview.users.total }}
      </div>
      <div class="mt-1 text-sm">
        区间活跃 {{ overview.users.activeInRange }} · 新增
        {{ overview.users.createdInRange }}
      </div></el-card
    >
    <el-card shadow="never"
      ><div class="text-sm text-gray-500">区间衣物草稿</div>
      <div class="mt-2 text-2xl font-semibold">
        {{ overview.garments.draft }}
      </div>
      <div class="mt-1 text-sm">
        快速入柜 {{ overview.quickIntakes.createdInRange }} · 搭配计划
        {{ overview.outfitPlans.createdInRange }}
      </div></el-card
    >
  </div>
</template>
