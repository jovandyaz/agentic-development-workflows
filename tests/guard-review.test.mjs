import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins", "workflows");
const script = join(plugin, "hooks", "guard-review.mjs");
const reviewers = ["workflows:quality-reviewer", "workflows:spec-reviewer", "workflows:standards-reviewer"];

function session(t, id = "session-1") {
  const data = mkdtempSync(join(tmpdir(), "guard-review-"));
  t.after(() => rmSync(data, { recursive: true, force: true }));
  const run = (input) =>
    spawnSync(process.execPath, [script], {
      input: typeof input === "string" ? input : JSON.stringify({ session_id: id, ...input }),
      encoding: "utf8",
      env: { PATH: process.env.PATH, CLAUDE_PLUGIN_DATA: data },
    });
  return {
    skill: (skill) => run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill } }),
    agent: (type, tool = "Agent") => run({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: { subagent_type: type } }),
    stop: (active = false) => run({ hook_event_name: "Stop", stop_hook_active: active }),
    prompt: (prompt) => run({ hook_event_name: "UserPromptSubmit", prompt }),
    async: (input) =>
      new Promise((done) => {
        const child = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, CLAUDE_PLUGIN_DATA: data } });
        child.on("close", done);
        child.stdin.end(JSON.stringify({ session_id: id, ...input }));
      }),
    raw: run,
    data,
  };
}

test("a turn without a review stops normally", (t) => {
  const s = session(t);
  s.skill("workflows:verifying-change");
  assert.equal(s.stop().status, 0);
});

test("a review that dispatched no reviewer agent cannot end the turn", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  const result = s.stop();
  assert.equal(result.status, 2);
  for (const reviewer of reviewers) assert.match(result.stderr, new RegExp(reviewer));
  assert.match(result.stderr, /never run a lens inline/);
});

test("a review that dispatched every reviewer agent stops normally", (t) => {
  const s = session(t);
  s.skill("reviewing-change");
  s.agent(reviewers[0]);
  s.agent(reviewers[1], "Task");
  s.agent(reviewers[2]);
  assert.equal(s.stop().status, 0);
});

test("names only the reviewer agents still missing", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  s.agent(reviewers[0]);
  s.agent("general-purpose");
  const result = s.stop();
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stderr, /quality-reviewer/);
  assert.match(result.stderr, /spec-reviewer.*standards-reviewer/);
});

test("blocks once per turn, carries the review into one more prompt, then forgets it", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  assert.equal(s.stop().status, 2);
  assert.equal(s.stop(true).status, 0, "stop_hook_active prevents a loop");
  s.prompt("Use main as the base.");
  assert.equal(s.stop().status, 2, "the answer to a scope question still needs the reviewers");
  assert.equal(s.stop(true).status, 0);
  s.prompt("Skip the review.");
  assert.equal(s.stop().status, 0, "the requirement never outlives one carried prompt");
});

test("lets a review that stopped to ask for its scope end the turn, then enforces it after the answer", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  const result = s.stop();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /stopped to ask for its scope, end the turn with that question/);
  assert.equal(s.stop(true).status, 0);
  s.prompt("Compare against release/2.0.");
  for (const reviewer of reviewers) s.agent(reviewer);
  assert.equal(s.stop().status, 0);
  assert.ok(!existsSync(join(s.data, "review-guard", "session-1")), "a completed review leaves nothing behind");
});

test("a review that dispatched some reviewers and skipped a lens is not carried into the next prompt", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  s.agent(reviewers[0]);
  s.agent(reviewers[2]);
  assert.equal(s.stop().status, 2);
  assert.equal(s.stop(true).status, 0);
  s.prompt("Now fix the null check.");
  assert.equal(s.stop().status, 0);
});

test("a typed review command while a review is carried starts over", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  s.stop();
  s.stop(true);
  s.prompt("/workflows:reviewing-change against main");
  assert.equal(s.stop().status, 2);
  for (const reviewer of reviewers) s.agent(reviewer);
  assert.equal(s.stop().status, 0);
});

test("keeps sessions apart", (t) => {
  const s = session(t, "a");
  s.skill("workflows:reviewing-change");
  const other = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ session_id: "b", hook_event_name: "Stop", stop_hook_active: false }),
    encoding: "utf8",
    env: { PATH: process.env.PATH, CLAUDE_PLUGIN_DATA: s.data },
  });
  assert.equal(other.status, 0);
  assert.equal(s.stop().status, 2);
});

test("records reviewers dispatched in parallel without losing one", async (t) => {
  for (let round = 0; round < 15; round += 1) {
    const s = session(t, `parallel-${round}`);
    s.skill("workflows:reviewing-change");
    await Promise.all(
      reviewers.map((type) => s.async({ hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { subagent_type: type } })),
    );
    const result = s.stop();
    assert.equal(result.status, 0, `round ${round}: ${result.stderr}`);
  }
});

test("a reviewer launched in the background counts only once its SubagentStop arrives", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  for (const reviewer of reviewers) {
    s.raw({ hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { subagent_type: reviewer, run_in_background: true }, tool_response: { isAsync: true, status: "async_launched" } });
  }
  const result = s.stop();
  assert.equal(result.status, 2, "launched is not reviewed");
  assert.match(result.stderr, /running in the background counts once it returns/);
  for (const reviewer of reviewers) s.raw({ hook_event_name: "SubagentStop", agent_id: "a1", agent_type: reviewer, stop_hook_active: false });
  assert.equal(s.stop().status, 0);
});

test("a reviewer's SubagentStop outside a review changes nothing", (t) => {
  const s = session(t);
  s.raw({ hook_event_name: "SubagentStop", agent_id: "a1", agent_type: reviewers[0] });
  s.skill("workflows:reviewing-change");
  assert.match(s.stop().stderr, /quality-reviewer/);
});

test("ignores tool events from inside a subagent", (t) => {
  const s = session(t);
  s.raw({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill: "workflows:reviewing-change" }, agent_id: "sub-1" });
  assert.equal(s.stop().status, 0);
});

test("a new prompt clears a review left over from an interrupted turn", (t) => {
  const s = session(t);
  s.skill("workflows:reviewing-change");
  s.prompt("What does convert.js do?");
  assert.equal(s.stop().status, 0);
});

test("a review started by typing its slash command is enforced too", (t) => {
  const s = session(t);
  s.prompt("/workflows:reviewing-change branch refactor/convert against main");
  assert.equal(s.stop().status, 2);
});

test("never blocks on its own failure", (t) => {
  const s = session(t);
  assert.equal(s.raw("not json").status, 0);
  assert.equal(s.raw({ hook_event_name: "Stop", session_id: "../../escape" }).status, 0);
});

test("hooks.json runs the review guard after Skill and agent calls and at Stop", () => {
  const config = JSON.parse(readFileSync(join(plugin, "hooks", "hooks.json"), "utf8"));
  const args = ["${CLAUDE_PLUGIN_ROOT}/hooks/guard-review.mjs"];
  const post = config.hooks.PostToolUse.find((entry) => entry.hooks.some((hook) => hook.args?.[0] === args[0]));
  assert.equal(post.matcher, "Skill|Agent|Task");
  assert.deepEqual(post.hooks[0].args, args);
  const stop = config.hooks.Stop.find((entry) => entry.hooks.some((hook) => hook.args?.[0] === args[0]));
  assert.equal(stop.hooks[0].command, "node");
  assert.ok(config.hooks.SubagentStop.some((entry) => entry.hooks.some((hook) => hook.args?.[0] === args[0])), "a background reviewer is recorded when it finishes");
  const prompt = config.hooks.UserPromptSubmit.find((entry) => entry.hooks.some((hook) => hook.args?.[0] === args[0]));
  assert.ok(prompt, "a new prompt resets the review state");
});
