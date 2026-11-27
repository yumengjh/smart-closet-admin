import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as Vue from "vue";
import { parse } from "vue/compiler-sfc";

const template = parse(
  await readFile(new URL("ModelUsage.vue", import.meta.url), "utf8")
).descriptor.template;
const ast = template.ast;
function findColumn(node) {
  if (
    node.tag === "el-table-column" &&
    node.props?.some(p => p.name === "label" && p.value?.content === "尝试链")
  )
    return node;
  for (const child of node.children || []) {
    const result = findColumn(child);
    if (result) return result;
  }
}
const column = findColumn(ast);
const render = Vue.compile(column.loc.source);

const source = parse(
  await readFile(new URL("TraceDrawer.vue", import.meta.url), "utf8")
).descriptor.scriptSetup.content;
const script = ts.transpileModule(
  `${source}\nglobalThis.subject = { open, drawer, traceId, attempts };`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;

test("最近调用的尝试链显示、点击与空值", async () => {
  const requests = [];
  const context = {
    exports: {},
    defineExpose: () => {},
    require(id) {
      if (id === "vue") return { ref: value => ({ value }) };
      if (id === "@/api/closet/modelInsights")
        return {
          getTrace: async traceId => {
            requests.push(traceId);
            return { data: { attempts: [{ attemptNo: 1 }] } };
          }
        };
      if (id === "../useClosetRequest")
        return {
          useClosetRequest: () => ({
            run: async (request, apply) => apply(await request())
          })
        };
      if (id === "../ClosetUnavailable.vue") return {};
      throw new Error(`unexpected import: ${id}`);
    }
  };
  vm.runInNewContext(script, context);
  const drawer = context.subject;
  let slot;
  const renderer = Vue.createRenderer({
    createComment: text => ({ text }),
    insert: () => {},
    remove: () => {},
    createText: text => ({ text }),
    setText: () => {},
    parentNode: () => null,
    nextSibling: () => null
  });
  const app = renderer.createApp({
    render: () => render({ traceDrawer: { open: drawer.open } }, [])
  });
  app.component("el-table-column", {
    setup(_, { slots }) {
      slot = slots.default;
      return () => Vue.createCommentVNode();
    }
  });
  app.component("el-button", { render: () => Vue.createCommentVNode() });
  app.mount({});
  const button = slot({ row: { traceId: "12345678-full-id" } })[0];
  assert.equal(button.children.default()[0].children, "12345678");
  button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ["12345678-full-id"]);
  assert.equal(drawer.drawer.value, true);
  assert.equal(drawer.traceId.value, "12345678-full-id");
  assert.equal(drawer.attempts.value[0].attemptNo, 1);
  const empty = slot({ row: { traceId: null } })[0];
  assert.equal(empty.children, "—");
  assert.deepEqual(requests, ["12345678-full-id"]);
});
