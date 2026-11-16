<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";

defineOptions({ name: "ClosetCreationGuide" });

const router = useRouter();
const { can } = useCurrentPermissions();
const activeFlow = ref("user-art");
const openQuestions = ref<string[]>([]);

const pages = [
  {
    title: "模型能力",
    path: "/creation/capabilities",
    permission: "closet:creation:read",
    purpose: "登记可用于穿搭创作的图像模型能力、参考图上限和人工验证记录。"
  },
  {
    title: "模板",
    path: "/creation/templates",
    permission: "closet:creation:read",
    purpose: "编辑三种创作效果的草稿，完成验证后发布模板版本。"
  },
  {
    title: "用量",
    path: "/creation/usage",
    permission: "closet:creation:read",
    purpose: "按日期查看请求、派发结果和模型费用估算。"
  },
  {
    title: "官方素材",
    path: "/creation/showcases",
    permission: "closet:showcase:read",
    purpose: "管理用户登录区域使用的公开 PNG 素材；它不管理用户私人作品。"
  }
];

function canOpen(permission: string) {
  return can(permission);
}

function openPage(path: string, permission: string) {
  if (!canOpen(permission)) return;
  void router.push(path);
}
</script>

<template>
  <section class="creation-guide">
    <header class="guide-heading">
      <div>
        <h1>穿搭创作使用指南</h1>
        <p>
          这里管理创作能力、效果模板和公开展示素材；实际生成由用户在自己的衣柜中完成。
        </p>
      </div>
      <el-tag effect="plain">管理员指南</el-tag>
    </header>

    <el-alert class="purpose-alert" type="info" :closable="false">
      <template #title>先分清两种用途</template>
      <p>
        <strong>用户艺术创作</strong
        >：管理员准备模型能力和效果模板，用户选择自己的衣物与形象生成私人作品。
        <strong>官方宣传素材</strong>：管理员上传另行准备并允许公开的
        PNG，用于用户端登录区域展示。 后台不会生成图片，也不会自动公开用户作品。
      </p>
    </el-alert>

    <section class="guide-section" aria-labelledby="page-map-title">
      <div class="section-heading">
        <h2 id="page-map-title">管理后台各页面</h2>
        <p>
          按账号权限打开对应页面。官方素材菜单位于“鱼搭业务”，也可以从这里进入。
        </p>
      </div>
      <ul class="page-list">
        <li v-for="page in pages" :key="page.path" class="page-row">
          <div class="page-copy">
            <div class="page-title">
              <h3>{{ page.title }}</h3>
              <el-tag
                v-if="page.title === '官方素材'"
                size="small"
                effect="plain"
                >鱼搭业务</el-tag
              >
            </div>
            <p>{{ page.purpose }}</p>
            <el-text
              v-if="!canOpen(page.permission)"
              class="permission-note"
              type="info"
              size="small"
            >
              当前账号缺少 {{ page.permission }} 查看权限，无法从此处打开。
            </el-text>
          </div>
          <el-button
            :disabled="!canOpen(page.permission)"
            @click="openPage(page.path, page.permission)"
          >
            打开页面
          </el-button>
        </li>
      </ul>
    </section>

    <section class="guide-section" aria-labelledby="workflow-title">
      <div class="section-heading">
        <h2 id="workflow-title">操作流程</h2>
        <p>用户作品和官方展示素材各自独立配置、独立发布。</p>
      </div>

      <el-tabs v-model="activeFlow" class="workflow-tabs">
        <el-tab-pane label="用户艺术创作" name="user-art">
          <div class="flow-intro">
            <h3>管理员准备，用户在衣柜里创作</h3>
            <p>
              保存草稿或记录验证都不会发起生图；发布模板也只让它可供用户选择。
            </p>
          </div>
          <ol class="steps">
            <li>
              <span class="step-number">01</span>
              <div>
                <h4>检查模型能力</h4>
                <p>
                  在“模型能力 →
                  新增能力”中，默认可复用已有生图配置，也可选择已配置的供应商和模型。
                  输出参数留空时继承默认值。先用真实请求确认多参考图能力，再填写参考图上限和说明；“已验证”只是人工记录，不会自动测试。这里没有
                  API Key 输入页。
                </p>
                <el-button
                  link
                  type="primary"
                  @click="
                    openPage('/creation/capabilities', 'closet:creation:read')
                  "
                >
                  打开模型能力
                </el-button>
              </div>
            </li>
            <li>
              <span class="step-number">02</span>
              <div>
                <h4>编辑效果模板草稿</h4>
                <p>
                  在“模板”中选择暖阳平铺、双视角画报或每日穿搭分享，配置名称、说明、示意素材、是否需要形象、衣物上限、光线、提示词和模型能力。
                  所需衣物数加形象数不能超过已验证的参考图上限。初始效果是草稿，不会自动发布。
                </p>
                <el-button
                  link
                  type="primary"
                  @click="
                    openPage('/creation/templates', 'closet:creation:read')
                  "
                >
                  打开模板
                </el-button>
              </div>
            </li>
            <li>
              <span class="step-number">03</span>
              <div>
                <h4>实际核对后记录验证并发布</h4>
                <p>
                  先核对真实生成效果，再填写至少 20
                  字且不含敏感信息的验证证据，点击“记录验证”，然后“发布版本”。
                  保存、记录验证和发布都不会代替质量核对。已发布模板需要复制新版本后再修改。
                </p>
              </div>
            </li>
            <li>
              <span class="step-number">04</span>
              <div>
                <h4>用户从自己的衣柜进入</h4>
                <p>
                  打开创作功能后，用户可从“试穿 →
                  穿搭创作”进入，也可从已保存搭配详情进入“我的作品”。
                  用户选择已拥有且图片已确认的衣物；平铺效果不需要形象，需要人物的效果则选择已确认属于自己的形象。成图为单张
                  3:4，完成的作品可在“我的作品”查看、保存或分享。只有请求实际派发后才会使用图片次数。
                </p>
              </div>
            </li>
          </ol>
        </el-tab-pane>

        <el-tab-pane label="官方展示素材" name="official-showcase">
          <div class="flow-intro">
            <h3>上传准备好的公开素材，不在后台生图</h3>
            <p>
              官方素材用于用户端登录区域的精选展示，与私人创作作品、今天页封面和创作功能开关分开。
            </p>
          </div>
          <ol class="steps">
            <li>
              <span class="step-number">01</span>
              <div>
                <h4>准备符合要求的 PNG</h4>
                <p>
                  文件不超过 10 MiB、2000 万像素，并保留显式 AI 生成标识及 PNG
                  内嵌的生成信息。 截图或只改文件后缀不能代替合格文件。
                </p>
              </div>
            </li>
            <li>
              <span class="step-number">02</span>
              <div>
                <h4>创建素材草稿</h4>
                <p>
                  在“鱼搭业务 →
                  官方素材”选择图片，填写来源说明、标题、说明和排序后创建草稿；排序数值越小越靠前。
                  这里只上传准备好的公开素材，不会调用生图模型。
                </p>
                <el-button
                  v-if="canOpen('closet:showcase:read')"
                  link
                  type="primary"
                  @click="
                    openPage('/creation/showcases', 'closet:showcase:read')
                  "
                >
                  打开官方素材
                </el-button>
                <el-text
                  v-else
                  class="permission-note"
                  type="info"
                  size="small"
                >
                  当前账号缺少 closet:showcase:read
                  查看权限，官方素材入口已禁用。
                </el-text>
              </div>
            </li>
            <li>
              <span class="step-number">03</span>
              <div>
                <h4>核对后发布并检查独立开关</h4>
                <p>
                  发布素材后，还要确认官方展示功能的部署开关已开启。这个开关与用户创作开关独立；收费开关不等于功能开关。
                </p>
              </div>
            </li>
            <li>
              <span class="step-number">04</span>
              <div>
                <h4>到用户端登录区域查看</h4>
                <p>
                  登录区域最多显示 12
                  条精选素材，不会替换“今天”首页封面。已发布素材要先下架再改文字或排序；换图片或来源时应新建素材。
                  下架不能撤回用户已经保存的文件。
                </p>
              </div>
            </li>
          </ol>
        </el-tab-pane>
      </el-tabs>
    </section>

    <section class="guide-section faq-section" aria-labelledby="faq-title">
      <div class="section-heading">
        <h2 id="faq-title">常见问题</h2>
        <p>遇到状态或版本变化时，先重新读取当前数据再继续操作。</p>
      </div>
      <el-collapse v-model="openQuestions">
        <el-collapse-item title="后台哪个按钮会生成图片？" name="generation">
          后台这些页面只管理配置、验证记录、用量和公开素材，不提供生成按钮。实际用户生成入口在用户端“试穿
          → 穿搭创作”。
        </el-collapse-item>
        <el-collapse-item
          title="创作功能已开启，用户仍看不到可用效果怎么办？"
          name="templates"
        >
          检查用户创作开关、模板是否已发布、模板绑定的模型能力是否已验证且版本匹配，以及衣物和形象数量是否在参考图上限内。
        </el-collapse-item>
        <el-collapse-item
          title="为什么创作入口或宣传素材没有显示？"
          name="switches"
        >
          用户创作和官方展示使用不同的部署开关；还需检查对应模板/素材是否已发布以及用户是否在正确页面查看。收费开关不能替代这两个功能开关；已登录后的“今天”页不是精选登录展示区域。
        </el-collapse-item>
        <el-collapse-item title="提示版本已变化时怎么办？" name="revision">
          重新读取最新数据后再操作。已发布模板先复制新版本；不要连续提交旧表单。
        </el-collapse-item>
        <el-collapse-item title="图片上传被拒怎么办？" name="upload">
          检查 PNG 格式、文件大小、像素、AI
          标识、内嵌生成信息和来源说明，并保留服务端返回的错误文字用于排查。
        </el-collapse-item>
        <el-collapse-item title="结果未知或费用未定价是什么意思？" name="usage">
          结果未知不能当作失败或免费，也不要因此重复创建任务；先核对任务结果。费用未定价表示没有可用费率，模型估算还不含存储、带宽等成本。
        </el-collapse-item>
      </el-collapse>
    </section>
  </section>
</template>

<style scoped>
.creation-guide {
  max-width: 1120px;
  padding: 24px;
  margin: 0 auto;
  overflow-wrap: anywhere;
}

.guide-heading,
.section-heading,
.page-title {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.guide-heading {
  margin-bottom: 20px;
}

.guide-heading h1,
.section-heading h2,
.flow-intro h3,
.page-title h3,
.steps h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.guide-heading h1 {
  font-size: 24px;
  line-height: 1.35;
}

.guide-heading p,
.section-heading p,
.page-copy p,
.flow-intro p,
.steps p {
  line-height: 1.75;
  color: var(--el-text-color-secondary);
}

.guide-heading p {
  max-width: 760px;
  margin: 8px 0 0;
}

.purpose-alert {
  margin-bottom: 24px;
}

.purpose-alert p {
  margin: 8px 0 0;
  line-height: 1.8;
}

.guide-section {
  margin-top: 28px;
}

.section-heading {
  display: block;
  margin-bottom: 12px;
}

.section-heading h2 {
  font-size: 18px;
}

.section-heading p {
  margin: 5px 0 0;
}

.page-list {
  padding: 0;
  margin: 0;
  list-style: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

.page-row {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 15px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.page-copy {
  min-width: 0;
}

.page-title {
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
}

.page-title h3 {
  font-size: 15px;
}

.page-copy p {
  margin: 5px 0 0;
}

.permission-note {
  display: block;
  margin-top: 4px;
}

.workflow-tabs {
  padding: 0 18px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.flow-intro {
  padding: 4px 0 12px;
}

.flow-intro h3 {
  font-size: 16px;
}

.flow-intro p {
  margin: 5px 0 0;
}

.steps {
  display: grid;
  gap: 4px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.steps li {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 14px;
  padding: 14px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.step-number {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--el-color-primary);
}

.steps h4 {
  font-size: 14px;
}

.steps p {
  margin: 5px 0 4px;
}

.faq-section {
  margin-bottom: 12px;
}

@media (width <= 640px) {
  .creation-guide {
    padding: 16px;
  }

  .guide-heading {
    gap: 10px;
  }

  .guide-heading h1 {
    font-size: 21px;
  }

  .page-row {
    gap: 12px;
    align-items: flex-start;
  }

  .workflow-tabs {
    padding: 0 12px 12px;
  }

  .steps li {
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
