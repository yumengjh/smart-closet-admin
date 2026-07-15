import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../api/resume.ts", import.meta.url), "utf8");

assert.match(source, /export const parseResumeDocument/);
assert.match(source, /export const toSavePayload/);
assert.match(source, /custom/);
assert.match(source, /\/resume\/manage/);
