<script setup lang="ts">
import type { UsageInsight } from "@/api/closet/insights";
import { closetFamilyLabel } from "@/api/closet/insights";
import { useRouter } from "vue-router";
const props = defineProps<{ usage: UsageInsight }>();
const router = useRouter();
const ownerReport = (username: string) =>
  void router.push({ path: "/closet/insights", query: { username } });
const dateText = (value: number) => new Date(value).toLocaleDateString();
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <el-card shadow="never">
      <template #header
        ><div class="flex items-center justify-between">
          <span>常用衣物 Top 10</span
          ><span class="text-sm text-gray-500"
            >已保存搭配 {{ usage.outfitCount }} 组</span
          >
        </div></template
      >
      <el-table
        :data="usage.topUsed"
        size="small"
        empty-text="暂无已保存搭配中的衣物"
      >
        <el-table-column prop="name" label="衣物" min-width="150"
          ><template #default="{ row }">{{
            row.name || "未命名衣物"
          }}</template></el-table-column
        >
        <el-table-column label="品类" width="110"
          ><template #default="{ row }">{{
            closetFamilyLabel(row.family)
          }}</template></el-table-column
        >
        <el-table-column prop="outfitCount" label="出现次数" width="105" />
        <el-table-column
          v-if="usage.scope.username == null"
          label="所属用户"
          min-width="120"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="ownerReport(row.owner)">{{
              row.owner
            }}</el-button></template
          ></el-table-column
        >
      </el-table>
    </el-card>
    <el-card shadow="never">
      <template #header
        ><div class="flex items-center justify-between">
          <span>较少出现在搭配中的衣物</span
          ><span class="text-sm text-gray-500"
            >{{ usage.idle.count }} 件 ·
            {{
              usage.idle.ratio == null
                ? "暂无比例"
                : `${(usage.idle.ratio * 100).toFixed(1)}%`
            }}</span
          >
        </div></template
      >
      <el-table
        :data="usage.idle.sample"
        size="small"
        empty-text="暂无闲置衣物"
      >
        <el-table-column prop="name" label="衣物" min-width="150"
          ><template #default="{ row }">{{
            row.name || "未命名衣物"
          }}</template></el-table-column
        >
        <el-table-column label="品类" width="110"
          ><template #default="{ row }">{{
            closetFamilyLabel(row.family)
          }}</template></el-table-column
        >
        <el-table-column label="录入时间" width="130"
          ><template #default="{ row }">{{
            dateText(row.createdAtMs)
          }}</template></el-table-column
        >
        <el-table-column
          v-if="usage.scope.username == null"
          label="所属用户"
          min-width="120"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="ownerReport(row.owner)">{{
              row.owner
            }}</el-button></template
          ></el-table-column
        >
      </el-table>
    </el-card>
  </div>
</template>
