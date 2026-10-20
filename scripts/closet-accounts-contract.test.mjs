import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as vue from "vue";
import { parse, compileScript } from "vue/compiler-sfc";

const require = createRequire(import.meta.url);
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const calls = [];
let reply = { data: {} };
const http = { request: async (...args) => { calls.push(args); return reply; } };
const permissions = new Set(["closet:user:read", "closet:user:write", "closet:registration:read", "closet:registration:write"]);
const messages = [];
let confirmed = true;
let publicUrl = "";
const scopes = [];
const hooks = { ...vue, onMounted: () => {}, onBeforeUnmount: () => {} };
const modules = {
  "@/utils/http": { http },
  "@/utils/message": { message: (...args) => messages.push(args) },
  "@/composables/useCurrentPermissions": { useCurrentPermissions: () => ({ can: permission => permissions.has(permission) }) },
  "vue-router": { useRouter: () => ({ push() {} }) },
  "element-plus": { ElMessageBox: { confirm: async () => { if (!confirmed) throw "cancel"; } } },
  vue: hooks
};
function evaluate(source) {
  const exports = {};
  const js = ts.transpileModule(source.replaceAll("import.meta.env.VITE_CLOSET_PUBLIC_URL", "__publicUrl"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(js, { exports, __publicUrl: publicUrl, navigator: { clipboard: { writeText: async () => {} } }, require: name => modules[name] ?? (name.endsWith(".vue") ? {} : require(name)) });
  return exports;
}
const users = evaluate(await read("src/api/closet/users.ts"));
const registration = evaluate(await read("src/api/closet/registration.ts"));
const labels = evaluate(await read("src/views/integrations/closet/accountLabels.ts"));
modules["@/api/closet/users"] = users;
modules["@/api/closet/registration"] = registration;
modules["@/api/closet/errors"] = evaluate(await read("src/api/closet/errors.ts"));
modules["../accountLabels"] = labels;
modules["../useClosetRequest"] = evaluate(await read("src/views/integrations/closet/useClosetRequest.ts"));
async function component(file, values = {}) {
  const { descriptor } = parse(await read(file), { filename: file });
  const source = compileScript(descriptor, { id: file }).content;
  const definition = evaluate(source).default;
  const props = vue.reactive(values);
  const emitted = [];
  const scope = vue.effectScope();
  scopes.push(scope);
  const state = scope.run(() => definition.setup(props, { expose() {}, emit: (...args) => emitted.push(args) }));
  return { state, props, emitted };
}
const plain = value => JSON.parse(JSON.stringify(value));
async function request(operation, expected) {
  calls.length = 0;
  await operation();
  assert.deepEqual(plain(calls), [expected]);
}
const username = "a/b 中文";
const encoded = encodeURIComponent(username);
await request(() => users.listClosetUsers({ page: 0, size: 20, registeredVia: "INVITE", deactivated: false, sort: "lastLoginAt" }), ["get", "/closet/users", { params: { page: 0, size: 20, registeredVia: "INVITE", deactivated: false, sort: "lastLoginAt" } }]);
await request(() => users.createClosetUser({ username: "alice", displayName: "小鱼", role: "USER", password: null }), ["post", "/closet/users", { data: { username: "alice", displayName: "小鱼", role: "USER", password: null } }]);
await request(() => users.updateClosetUserProfile(username, ""), ["patch", `/closet/users/${encoded}/profile`, { data: { displayName: "" } }]);
await request(() => users.revokeClosetUserSession(username, "0123456789abcdef"), ["delete", `/closet/users/${encoded}/sessions/0123456789abcdef`]);
await request(() => users.getClosetUserLoginLock(username), ["get", `/closet/users/${encoded}/login-lock`]);
await request(() => users.clearClosetUserLoginLock(username), ["delete", `/closet/users/${encoded}/login-lock`]);
await request(() => users.getClosetUserEvents(username), ["get", `/closet/users/${encoded}/events`]);
const auditQuery = { from: "2026-10-01", to: "2026-10-20", username: "alice", actor: "manage:primary", action: "MANAGE_PROFILE_UPDATED", page: 0, size: 20 };
await request(() => users.listClosetAccountEvents(auditQuery), ["get", "/closet/account-events", { params: auditQuery }]);
await request(() => registration.getClosetRegistration(), ["get", "/closet/registration"]);
for (const mode of ["CLOSED", "INVITE", "OPEN", null]) {
  await request(() => registration.updateClosetRegistration(mode), ["put", "/closet/registration", { data: { mode } }]);
}
await request(() => registration.listClosetInvites({ page: 0, size: 20, status: "ACTIVE" }), ["get", "/closet/invites", { params: { page: 0, size: 20, status: "ACTIVE" } }]);
await request(() => registration.createClosetInvite({ note: "活动", maxUses: 10, expiresInDays: 7 }), ["post", "/closet/invites", { data: { note: "活动", maxUses: 10, expiresInDays: 7 } }]);
await request(() => registration.getClosetInvite("id/1"), ["get", "/closet/invites/id%2F1"]);
await request(() => registration.updateClosetInvite("id/1", { note: "", expiresAtMs: 1234 }), ["patch", "/closet/invites/id%2F1", { data: { note: "", expiresAtMs: 1234 } }]);
await request(() => registration.revokeClosetInvite("id/1"), ["delete", "/closet/invites/id%2F1"]);
for (const prefix of ["ADMIN", "MANAGE"]) {
  for (const suffix of ["USER_CREATED", "USER_ENABLED", "USER_DISABLED", "ROLE_CHANGED", "PASSWORD_RESET", "SESSIONS_REVOKED", "QUOTA_CHANGED"]) {
    assert.notEqual(labels.accountActionName(`${prefix}_${suffix}`), `${prefix}_${suffix}`);
  }
}
assert.equal(labels.accountActionName("MANAGE_PROFILE_UPDATED"), "管理平台修改资料");
assert.equal(labels.accountActionName("FUTURE_ACTION"), "FUTURE_ACTION");
for (const key of ["closet-registration", "closet-account-events"]) {
  for (const path of ["src/router/utils.ts", "src/api/routes.ts", "src/api/navigation.ts", "src/views/system/menu/index.vue"]) {
    assert.ok((await read(path)).includes(`"${key}"`), `${path} missing ${key}`);
  }
}
assert.match(await read("src/utils/http/index.ts"), /baseURL:.*"\/api\/v1"/);

// Execute component setup with the real Vue reactivity/compiler and a mock transport.
const { state: list } = await component("src/views/integrations/closet/users/index.vue");
reply = { data: { items: [], totalElements: 0 } };
list.deactivated.value = false;
list.registeredVia.value = "OPEN";
await list.load();
assert.equal(calls.at(-1)[2].params.page, 0);
assert.equal(calls.at(-1)[2].params.deactivated, false);
list.onSortChange({ prop: "lastLoginAtMs", order: "ascending" });
assert.equal(calls.at(-1)[2].params.sort, "lastLoginAt");
assert.equal(calls.at(-1)[2].params.order, "asc");
const { state: audit } = await component("src/views/integrations/closet/account-events/index.vue");
audit.dates.value = ["2026-10-01", "2026-10-20"];
audit.username.value = " alice ";
audit.actor.value = " manage:primary ";
audit.action.value = "MANAGE_PROFILE_UPDATED";
audit.page.value = 2;
await audit.load();
assert.deepEqual(plain(calls.at(-1)[2].params), { ...auditQuery, page: 1 });
audit.openUser("alice");
assert.equal(audit.selected.value.username, "alice");
assert.equal(audit.detailOpen.value, true);
const { state: reg } = await component("src/views/integrations/closet/registration/index.vue");
reg.state.value = { mode: "INVITE", configuredMode: "CLOSED", overridden: true };
reg.mode.value = "OPEN";
confirmed = false;
calls.length = 0;
await reg.changeMode();
assert.equal(calls.length, 0, "cancelled mode change must not write");
assert.equal(reg.mode.value, "INVITE");
await reg.revoke({ id: "invite-1" });
assert.equal(calls.length, 0, "cancelled revocation must not write");
permissions.delete("closet:registration:write");
confirmed = true;
await reg.changeMode(true);
await reg.revoke({ id: "invite-1" });
assert.equal(calls.length, 0, "read-only user cannot write");
permissions.add("closet:registration:write");
// Simulate independent responses for registration and invite listing.
const originalRequest = http.request;
http.request = async (...args) => { calls.push(args); return { data: args[1].endsWith("/registration") ? { mode: "CLOSED", configuredMode: "CLOSED", overridden: false } : { items: [], totalElements: 0 } }; };
await reg.changeMode(true);
assert.deepEqual(plain(calls[0]), ["put", "/closet/registration", { data: { mode: null } }]);
http.request = originalRequest;
publicUrl = "https://closet.example.com/";
const { state: result, props: resultProps } = await component("src/views/integrations/closet/registration/InviteResultDialog.vue", { modelValue: true, code: "TEST-CODE" });
assert.equal(result.link.value, "https://closet.example.com/register?invite=TEST-CODE");
resultProps.code = "";
assert.equal(result.link.value, "", "cleared code must also clear link");
publicUrl = "";
const { state: withoutUrl } = await component("src/views/integrations/closet/registration/InviteResultDialog.vue", { modelValue: true, code: "TEST-CODE" });
assert.equal(withoutUrl.link.value, "");
assert.match(await read("src/views/integrations/closet/registration/index.vue"), /@closed="code = ''"/);
// An empty nickname is an explicit clear, and revoked sessions target the selected row.
const { state: detail } = await component("src/views/integrations/closet/users/UserDetailDrawer.vue", { modelValue: false, user: { username: "alice" } });
detail.detail.value = { username: "alice" };
detail.displayName.value = "   ";
await request(() => detail.saveProfile(), ["patch", "/closet/users/alice/profile", { data: { displayName: "" } }]);
await request(() => detail.revokeSession({ sessionRef: "0123456789abcdef" }), ["delete", "/closet/users/alice/sessions/0123456789abcdef"]);
await request(() => detail.unlock(), ["delete", "/closet/users/alice/login-lock"]);
permissions.delete("closet:user:write");
calls.length = 0;
await detail.saveProfile();
await detail.unlock();
await detail.revokeSession({ sessionRef: "0123456789abcdef" });
assert.equal(calls.length, 0, "read-only user cannot modify the user");
permissions.add("closet:user:write");
const { state: inviteForm, emitted: formEmitted } = await component("src/views/integrations/closet/registration/InviteFormDialog.vue", { modelValue: true, invite: { id: "invite-1" } });
inviteForm.formRef.value = { validate: async () => true };
Object.assign(inviteForm.form, { note: "", maxUses: 10, expiresAtMs: "1799999999000" });
await request(() => inviteForm.save(), ["patch", "/closet/invites/invite-1", { data: { note: "", maxUses: 10, expiresAtMs: 1799999999000 } }]);
assert.equal(formEmitted[0][0], "saved");
const { state: createForm, emitted: createdEmitted } = await component("src/views/integrations/closet/registration/InviteFormDialog.vue", { modelValue: true });
createForm.formRef.value = { validate: async () => true };
reply = { data: { code: "ONCE-ONLY" } };
await createForm.save();
assert.equal(createdEmitted[0][0], "created");
assert.equal(createdEmitted[0][1], "ONCE-ONLY");
// The shared request helper hides the data on a disabled integration.
http.request = async () => { throw { response: { status: 503, data: { code: "CLOSET_SERVICE_UNAVAILABLE" } } }; };
await list.load();
assert.equal(list.unavailable.value, true);
assert.equal(list.loading.value, false);
// A slow older filter must never overwrite the latest result.
let resolveOld;
http.request = () => new Promise(resolve => { resolveOld = resolve; });
const oldLoad = list.load();
http.request = async () => ({ data: { items: [{ username: "new-filter" }], totalElements: 1 } });
await list.load();
resolveOld({ data: { items: [{ username: "old-filter" }], totalElements: 1 } });
await oldLoad;
assert.equal(list.rows.value[0].username, "new-filter");
http.request = originalRequest;
for (const scope of scopes) scope.stop();
console.log("Closet accounts contract passed: request paths/payloads, zero-based pagination, labels, permissions, confirmation cancellation, one-time invite links.");
