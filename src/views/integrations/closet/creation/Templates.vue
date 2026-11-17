<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getCreationTemplates,
  type TemplateSummary
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import EffectEditor from "./EffectEditor.vue";
import { effectState, errorText } from "./effectShared";

defineOptions({ name: "ClosetCreationTemplates" });
const { can } = useCurrentPermissions();
const templates = ref<TemplateSummary[]>([]);
const loading = ref(false);
const editing = ref<string>();

async function refresh() {
  if (!can("closet:creation:read")) return;
  loading.value = true;
  try {
    templates.value = (await getCreationTemplates()).data.items;
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    loading.value = false;
  }
}
function back() {
  editing.value = undefined;
  void refresh();
}
onMounted(refresh);
</script>

<template>
  <section class="creation-page">
    <EffectEditor v-if="editing" :template-id="editing" @back="back" />
    <template v-else>
      <h1>创作效果</h1>
      <p class="caption">每个效果上线前，先试做一张看看效果。</p>
      <div v-loading="loading" class="effects">
        <article v-for="t in templates" :key="t.id" class="effect">
          <div class="thumb">暂无示意图</div>
          <div class="body">
            <strong class="name">{{ effectState(t).name }}</strong>
            <el-tag :type="effectState(t).tone" effect="plain">{{
              effectState(t).label
            }}</el-tag>
            <el-button class="open" @click="editing = t.id">{{
              can("closet:creation:write") ? "编辑" : "查看"
            }}</el-button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.creation-page {
  padding: 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
.caption {
  margin: 0 0 20px;
  color: var(--el-text-color-secondary);
}
.effects {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 80px;
}
.effect {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}
.body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 12px 16px 16px;
}
.name {
  flex: 1 1 100%;
  font-size: 16px;
}
.open {
  margin-left: auto;
}
@media (width <= 900px) {
  .effects {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (width <= 600px) {
  .creation-page {
    padding: 16px;
  }
}
</style>
