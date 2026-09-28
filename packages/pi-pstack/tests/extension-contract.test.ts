import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import pstack from "../extensions/pstack/index.js";

test("pstack registers Poteto Mode and roles without a tool-call gate", () => {
  const events = new Set<string>();
  const commands = new Set<string>();
  const pi = {
    on(eventName: string, _handler: unknown) {
      events.add(eventName);
    },
    events: {
      on(_channel: string, _handler: unknown) {
        return () => {};
      },
    },
    registerCommand(name: string, _definition: unknown) {
      commands.add(name);
    },
  } as unknown as ExtensionAPI;

  pstack(pi);

  for (const event of [
    "session_start",
    "input",
    "before_agent_start",
    "session_shutdown",
  ]) {
    assert.ok(events.has(event), `missing ${event} handler`);
  }
  assert.ok(commands.has("poteto-mode"));
  assert.ok(!events.has("tool_call"), "pstack must not intercept tool calls");
});
