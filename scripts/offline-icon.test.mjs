import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createSSRApp, h, defineComponent } from "vue";
import { renderToString } from "vue/server-renderer";

const require = createRequire(import.meta.url);
const source = await readFile(
  new URL(
    "../src/components/ReIcon/src/iconifyIconOffline.ts",
    import.meta.url
  ),
  "utf8"
);
const exports = {};
runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports, require },
  { filename: "iconifyIconOffline.js" }
);
const component = exports.default;
const render = icon =>
  renderToString(createSSRApp({ render: () => h(component, { icon }) }));
const data = {
  width: 16,
  height: 16,
  body: '<path data-test="local-icon" d="M0 0h16v16z"/>'
};
require("@iconify/vue/dist/offline").addIcon("security-test-icon", data);
assert.match(await render("security-test-icon"), /data-test="local-icon"/);
assert.match(
  await render(data),
  /data-test="local-icon"/,
  "raw offline data is rendered as Iconify data, not registered as an object name"
);
assert.match(
  await render(
    defineComponent({ render: () => h("svg", { "data-test": "vue-icon" }) })
  ),
  /data-test="vue-icon"/
);
console.log(
  "Offline named, data and Vue component icons render without network access"
);
