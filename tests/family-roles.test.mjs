// Bus 87: owner / editor / member, and the actor family-media is told.
import { test } from "node:test";
import assert from "node:assert/strict";
import { familyRoleOf, mediaActorFor } from "../app/lib/family-roles.mjs";

const owners = ["owner@example.test"], editors = ["editor@example.test", "owner@example.test"];
test("roles: owner list wins; editors; everyone else a member; case and spaces ignored", () => {
  assert.equal(familyRoleOf(" Owner@Example.test ", owners, editors), "owner");
  assert.equal(familyRoleOf("editor@example.test", owners, editors), "editor");
  assert.equal(familyRoleOf("member@example.test", owners, editors), "member");
  assert.equal(familyRoleOf("", owners, editors), "member");
  assert.equal(familyRoleOf("editor@example.test", owners, []), "member", "no editor list → no editors");
});
test("media actor: an editor is always prefixed, so the service can only accept proposals from her", () => {
  assert.equal(mediaActorFor("editor", "Editor@example.test"), "editor:editor@example.test");
  assert.equal(mediaActorFor("owner", "owner@example.test"), "owner@example.test");
});
