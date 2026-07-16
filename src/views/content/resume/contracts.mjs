import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../api/resume.ts", import.meta.url), "utf8");
const view = await readFile(new URL("index.vue", import.meta.url), "utf8");

assert.match(source, /export const parseResumeDocument/);
assert.match(source, /export const toSavePayload/);
assert.match(source, /custom/);
assert.match(source, /\/resume\/manage/);
assert.match(source, /getResumeFeedback/);
assert.match(source, /updateResumeFeedbackStatus/);
assert.match(view, /el-tabs/);
assert.match(view, /反馈/);
assert.match(view, /标记已读/);
