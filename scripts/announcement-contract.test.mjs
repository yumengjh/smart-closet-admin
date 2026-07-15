import assert from "node:assert/strict";
import { announcementPayload } from "../src/views/content/announcement-contracts.mjs";

assert.throws(() => announcementPayload("", "body"));
assert.throws(() => announcementPayload("title", "  "));
assert.deepEqual(announcementPayload(" title ", " body "), {
  title: "title",
  content: "body"
});

console.log("announcement contracts passed");
