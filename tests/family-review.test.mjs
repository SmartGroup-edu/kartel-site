// Bus 87: the owner's before/after view of an editor's proposal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wordDiff, diffKey } from "../app/lib/family-review.mjs";

const join = (d, t) => d.filter((x) => x.t !== t).map((x) => x.s).join("");
test("word diff: the old text without additions, the new text without deletions", () => {
  const a = "Synthetic story about the old house.", b = "Synthetic short story about the new house.";
  const d = wordDiff(a, b);
  assert.equal(join(d, "add"), a); assert.equal(join(d, "del"), b);
  assert.deepEqual(d.filter((x) => x.t !== "same").map((x) => [x.t, x.s.trim()]), [["add", "short"], ["del", "old"], ["add", "new"]]);
  assert.deepEqual(wordDiff("", "New"), [{ t: "add", s: "New" }]);
});
test("person: alt text and the portrait (replace, add, remove)", () => {
  const ch = diffKey("person:p1", { portrait: "a", altEN: "x", altRU: "" }, { portrait: "b", altEN: "y", altRU: "" });
  assert.deepEqual(ch.map((c) => c.type), ["text", "portrait"]);
  assert.deepEqual(diffKey("person:p1", null, { portrait: "b", altEN: "", altRU: "" }).map((c) => [c.type, c.before, c.after]), [["portrait", null, "b"]]);
  assert.deepEqual(diffKey("person:p1", { portrait: "b" }, { portrait: null }).map((c) => [c.type, c.after]), [["portrait", null]], "a proposed removal");
});
test("entry: texts, photos added/removed, caption edits; nothing when equal", () => {
  const before = { storyRU: "Старый текст", photos: [{ id: "p1", captionEN: "", captionRU: "Одна" }, { id: "p2", captionEN: "", captionRU: "" }] };
  const after = { storyRU: "Новый текст", photos: [{ id: "p1", captionEN: "", captionRU: "Одна правка" }, { id: "p3", captionEN: "", captionRU: "Три" }] };
  assert.deepEqual(diffKey("event:e1", before, after).map((c) => [c.type, c.id ?? c.field]), [["text", "storyRU"], ["photo_added", "p3"], ["photo_removed", "p2"], ["caption", "p1"]]);
  assert.deepEqual(diffKey("event:e1", after, after), []);
});
