import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import pstack from "../extensions/pstack/index.js";

type ToolHandler = (event: unknown, ctx: unknown) => Promise<unknown>;

function startExtension(): { events: Map<string, unknown>; commands: Set<string> } {
  const events = new Map<string, unknown>();
  const commands = new Set<string>();
  const pi = {
    on(eventName: string, handler: unknown) {
      events.set(eventName, handler);
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
  return { events, commands };
}

test("pstack config controls Bash confirmation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pstack-config-"));
  const oldDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const { events, commands } = startExtension();
    for (const event of ["session_start", "input", "before_agent_start", "session_shutdown"])
      assert.ok(events.has(event), `missing ${event} handler`);
    assert.ok(commands.has("poteto-mode"));
    const gate = events.get("tool_call") as ToolHandler;
    assert.ok(gate);
    let prompts = 0;
    const confirm = async () => { prompts++; return true; };
    assert.equal(await gate({ toolName: "bash", input: { command: "git status" } }, { hasUI: true, ui: { confirm } }), undefined);
    assert.equal(prompts, 0);
    assert.equal(await gate({ toolName: "read", input: { command: "git push" } }, { hasUI: false }), undefined);
    assert.deepEqual(await gate({ toolName: "bash", input: { command: "git push" } }, { hasUI: false }), {
      block: true,
      reason: "git push requires explicit user confirmation; non-interactive Pi cannot request it.",
    });
    assert.equal(await gate({ toolName: "bash", input: { command: "git push" } }, { hasUI: true, ui: { confirm } }), undefined);
    assert.equal(prompts, 1);
    assert.deepEqual(await gate({ toolName: "bash", input: { command: "gh pr merge 1" } }, {
      hasUI: true, ui: { confirm: async () => false },
    }), { block: true, reason: "User declined GitHub pull-request mutation." });

    mkdirSync(join(dir, "pstack"));
    writeFileSync(join(dir, "pstack/config.json"), '{"confirmExternalActions":false}');
    assert.equal(startExtension().events.has("tool_call"), false);

    writeFileSync(join(dir, "pstack/config.json"), '{"confirmExternalActions":"false"}');
    assert.ok(startExtension().events.has("tool_call"));
    writeFileSync(join(dir, "pstack/config.json"), "not json");
    assert.ok(startExtension().events.has("tool_call"));
  } finally {
    if (oldDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = oldDir;
    rmSync(dir, { recursive: true, force: true });
  }
});
