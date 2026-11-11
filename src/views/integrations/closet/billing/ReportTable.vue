<script setup lang="ts">
import type { ReportRow } from "@/api/closet/billing";
import { money } from "./useBilling";
import { percent } from "../useClosetRequest";
defineProps<{
  rows: ReportRow[];
  columns: { key: string; label: string; format?: string }[];
}>();
function display(value: ReportRow[string], format?: string) {
  if (value == null) return "—";
  if (format === "micro") return money(Number(value), 1000000);
  if (format === "percent") return percent(Number(value));
  if (typeof value === "boolean") return value ? "是" : "否";
  return value;
}
</script>
<template>
  <el-table :data="rows" stripe
    ><el-table-column
      v-for="column in columns"
      :key="column.key"
      :label="column.label"
      :min-width="150"
      ><template #default="{ row }">{{
        display(row[column.key], column.format)
      }}</template></el-table-column
    ></el-table
  >
</template>
