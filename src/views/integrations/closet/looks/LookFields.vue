<script setup lang="ts">
import type {
  LookCategory,
  LookCoverage,
  LookGender
} from "@/api/closet/looks";
import type { LookForm } from "./lookLogic";

defineProps<{ categories: LookCategory[] }>();
const form = defineModel<LookForm>({ required: true });
const coverages: Record<LookCoverage, string> = {
  FULL: "全身",
  UPPER: "上半身",
  LOWER: "下半身"
};
const genders: Record<LookGender, string> = {
  FEMALE: "女款",
  MALE: "男款",
  UNISEX: "中性"
};
</script>

<template>
  <el-form-item label="名称">
    <el-input v-model="form.name" maxlength="16" show-word-limit />
  </el-form-item>
  <el-form-item label="分类">
    <el-select v-model="form.category" placeholder="选择分类">
      <el-option
        v-for="item in categories"
        :key="item.key"
        :label="item.enabled ? item.name : `${item.name}（已停用）`"
        :value="item.key"
      />
    </el-select>
  </el-form-item>
  <el-form-item label="标签">
    <el-select
      v-model="form.tags"
      multiple
      filterable
      allow-create
      default-first-option
      :multiple-limit="8"
      placeholder="输入后回车，最多 8 个，每个最多 8 个字"
    />
  </el-form-item>
  <el-form-item label="覆盖范围">
    <el-radio-group v-model="form.coverage">
      <el-radio-button
        v-for="(label, value) in coverages"
        :key="value"
        :value="value"
        >{{ label }}</el-radio-button
      >
    </el-radio-group>
  </el-form-item>
  <el-form-item label="性别（只用于本地排序）">
    <el-radio-group v-model="form.gender">
      <el-radio-button
        v-for="(label, value) in genders"
        :key="value"
        :value="value"
        >{{ label }}</el-radio-button
      >
    </el-radio-group>
  </el-form-item>
</template>
