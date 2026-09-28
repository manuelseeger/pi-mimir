import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPstackRoles } from "./roles.js";

const MODE_ENTRY = "pstack-mode";

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

export default function (pi: ExtensionAPI) {
  registerPstackRoles(pi);

  let potetoMode = false;

  pi.on("session_start", (_event, ctx) => {
    potetoMode = false;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom") continue;
      if (entry.customType === MODE_ENTRY)
        potetoMode = Boolean((entry.data as { enabled?: boolean }).enabled);
    }
    if (ctx.hasUI)
      ctx.ui.setStatus(
        "pstack-mode",
        potetoMode ? "pstack: poteto mode" : undefined,
      );
  });

  pi.on("input", (event) => {
    if (/^\/skill:poteto-mode(?:\s|$)/.test(event.text)) {
      potetoMode = true;
      pi.appendEntry(MODE_ENTRY, { enabled: true });
    }
    return { action: "continue" } as const;
  });

  pi.on("before_agent_start", (event) => {
    if (!potetoMode) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\nPstack Poteto Mode is enabled for this session. Follow its persisted workflow: track non-trivial work in the session's task tools, select and read the matching playbook, delegate through the subagent tool when delegation helps, verify real behavior, and name only principles that changed a decision. The full skill is at ${path.join(packageRoot(), "skills/poteto-mode/SKILL.md")}.`,
    };
  });

  pi.registerCommand("poteto-mode", {
    description:
      "Enable or disable sticky pstack Poteto Mode for this Pi session. Usage: /poteto-mode [task] | /poteto-mode off",
    handler: async (args, ctx) => {
      if (/^(off|disable|stop)$/i.test(args.trim())) {
        potetoMode = false;
        pi.appendEntry(MODE_ENTRY, { enabled: false });
        ctx.ui.setStatus("pstack-mode", undefined);
        ctx.ui.notify("Poteto Mode disabled for this session.", "info");
        return;
      }
      potetoMode = true;
      pi.appendEntry(MODE_ENTRY, { enabled: true });
      ctx.ui.setStatus("pstack-mode", "pstack: poteto mode");
      pi.sendUserMessage(
        `/skill:poteto-mode${args.trim() ? ` ${args.trim()}` : ""}`,
      );
    },
  });

}
