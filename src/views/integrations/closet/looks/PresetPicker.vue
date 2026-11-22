<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getPresetImage,
  getPresets,
  type ManagedPreset,
  type PresetGroup
} from "@/api/closet/presets";
import PresetImage from "../PresetImage.vue";
import { useClosetRequest } from "../useClosetRequest";
import { COMPOSE_MAX } from "./lookLogic";

const selected = defineModel<string[]>({ required: true });
const groups: Record<PresetGroup, string> = {
  top: "上装",
  bottom: "下装",
  outer: "外套",
  "one-piece": "连体",
  shoes: "鞋",
  accessory: "配件"
};
const size = 24;
const request = useClosetRequest();
const rows = ref<ManagedPreset[]>([]);
const total = ref(0);
const page = ref(1);
const group = ref<PresetGroup>();
const query = ref("");
const names = ref(new Map<string, string>());

function refresh(reset = false) {
  if (reset) page.value = 1;
  return request.run(
    () =>
      getPresets({
        page: page.value - 1,
        size,
        status: "LISTED",
        group: group.value || undefined,
        q: query.value.trim()
      }),
    ({ data }) => {
      rows.value = data.items;
      total.value = data.total;
      for (const row of data.items)
        names.value.set(row.id, row.name || "未命名衣物");
    }
  );
}
function remove(id: string) {
  selected.value = selected.value.filter(value => value !== id);
}
onMounted(() => void refresh());
</script>

<template>
  <div class="picker">
    <el-form inline class="filters" @submit.prevent="refresh(true)">
      <el-form-item label="品类组">
        <el-select
          v-model="group"
          clearable
          placeholder="全部品类"
          @change="refresh(true)"
        >
          <el-option
            v-for="(label, value) in groups"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="名称">
        <el-input
          v-model="query"
          clearable
          placeholder="搜索名称"
          @clear="refresh(true)"
        />
      </el-form-item>
      <el-button native-type="submit">搜索</el-button>
    </el-form>
    <div class="chosen">
      <span class="muted"
        >已选 {{ selected.length }} / {{ COMPOSE_MAX }}，按选择顺序拼图：</span
      >
      <el-tag
        v-for="id in selected"
        :key="id"
        closable
        size="small"
        @close="remove(id)"
        >{{ names.get(id) ?? id.slice(0, 8) }}</el-tag
      >
    </div>
    <el-empty
      v-if="!rows.length && !request.loading.value"
      :description="
        request.unavailable.value ? '鱼搭服务暂不可用' : '没有已上架的预设衣物'
      "
    />
    <el-checkbox-group
      v-model="selected"
      v-loading="request.loading.value"
      :max="COMPOSE_MAX"
      class="grid"
    >
      <article v-for="row in rows" :key="row.id" class="card">
        <PresetImage
          :label="row.name || '预设衣物'"
          :load="() => getPresetImage(row.id)"
        />
        <span class="meta">
          <el-checkbox :value="row.id">{{
            row.name || "未命名衣物"
          }}</el-checkbox>
          <span class="muted">{{
            groups[row.group as PresetGroup] ?? "其他"
          }}</span>
        </span>
      </article>
    </el-checkbox-group>
    <el-pagination
      v-if="total > size"
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next"
      @current-change="refresh()"
    />
  </div>
</template>

<style scoped>
.muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.filters :deep(.el-select) {
  min-width: 130px;
}

.chosen {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 28px;
  margin-bottom: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  max-height: 46vh;
  overflow: auto;
}

.card {
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
}

.meta :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.el-pagination {
  margin-top: 8px;
}
</style>
