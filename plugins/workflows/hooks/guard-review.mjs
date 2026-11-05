#!/usr/bin/env node
// Fails open: any internal error exits 0, so a bug here never traps a turn.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REVIEWERS = ["workflows:quality-reviewer", "workflows:spec-reviewer", "workflows:standards-reviewer"];
const AGENT_TOOLS = new Set(["Agent", "Task"]);
const REVIEW_SKILL = /^(?:workflows:)?reviewing-change$/;
const REVIEW_COMMAND = /^\/(?:workflows:)?reviewing-change(?:\s|$)/;

// The reviewers are dispatched in parallel, so each one gets its own marker file:
// concurrent hook processes never read and rewrite a shared record.
function sessionDirectory(sessionId) {
  if (!/^[\w-]+$/.test(sessionId ?? "")) return null;
  return join(process.env.CLAUDE_PLUGIN_DATA || tmpdir(), "review-guard", sessionId);
}

const marker = (reviewer) => reviewer.replace(":", "--");
// A review that ended its turn without dispatching any reviewer, usually to ask for its
// scope, stays required for exactly one more prompt, so the hook can neither loop nor linger.
const AWAITING = "awaiting-answer";
const CARRIED = "carried";

function startReview(directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "started"), "");
}

export function missingReviewers(directory) {
  if (!existsSync(join(directory, "started"))) return [];
  return REVIEWERS.filter((reviewer) => !existsSync(join(directory, marker(reviewer))));
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const directory = sessionDirectory(input.session_id);
  if (!directory) return 0;
  if (input.hook_event_name === "SubagentStop") {
    if (REVIEWERS.includes(input.agent_type) && existsSync(join(directory, "started"))) writeFileSync(join(directory, marker(input.agent_type)), "");
    return 0;
  }
  // Subagent tool events carry agent_id; a subagent cannot dispatch the reviewers.
  if (input.agent_id) return 0;

  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      if (REVIEW_COMMAND.test(input.prompt ?? "")) startReview(directory);
      else if (existsSync(join(directory, AWAITING))) {
        rmSync(join(directory, AWAITING));
        writeFileSync(join(directory, CARRIED), "");
      } else rmSync(directory, { recursive: true, force: true });
      return 0;
    case "PostToolUse": {
      const { tool_name: tool, tool_input: args = {} } = input;
      if (tool === "Skill" && REVIEW_SKILL.test(args.skill ?? "")) startReview(directory);
      // A background launch returns before the reviewer has looked at anything; its SubagentStop records it.
      else if (AGENT_TOOLS.has(tool) && REVIEWERS.includes(args.subagent_type) && existsSync(join(directory, "started"))) {
        if (input.tool_response?.status !== "async_launched") writeFileSync(join(directory, marker(args.subagent_type)), "");
      }
      return 0;
    }
    case "Stop": {
      const missing = missingReviewers(directory);
      if (missing.length === 0 || (input.stop_hook_active && existsSync(join(directory, CARRIED)))) {
        rmSync(directory, { recursive: true, force: true });
        return 0;
      }
      // stop_hook_active means this turn was already sent back once; blocking again would loop.
      if (input.stop_hook_active) {
        // Only a turn that dispatched no reviewer can be waiting on a scope answer; one that dispatched some skipped a lens on purpose.
        if (missing.length === REVIEWERS.length) writeFileSync(join(directory, AWAITING), "");
        else rmSync(directory, { recursive: true, force: true });
        return 0;
      }
      process.stderr.write(
        `Blocked by the workflows plugin: reviewing-change ran without dispatching ${missing.join(", ")}. ` +
          "Dispatch each missing reviewer agent with the scope material, whatever the diff's size; never run a lens inline. " +
          "A reviewer running in the background counts once it returns, so wait for its result before reporting. " +
          "If reviewing-change stopped to ask for its scope, end the turn with that question; the reviewers are required after the answer. " +
          "If the user explicitly asked to skip a lens, say so in the report instead.\n",
      );
      return 2;
    }
    default:
      return 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let code = 0;
  try {
    code = main();
  } catch {
    code = 0;
  }
  process.exit(code);
}
