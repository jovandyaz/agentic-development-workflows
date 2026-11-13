#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p src/socket src/turns client test
printf '{\n  "name": "chat-server",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > README.md <<'MD'
# chat-server

Socket handlers for a chat assistant.

- `src/socket/schema.js` validates incoming messages.
- `src/socket/handler.js` handles a message and runs one assistant turn.
- `src/leases.js` serialises work per conversation.
- `client/chat-client.js` is the bundled client.

A conversation runs one turn at a time.
MD
cat > src/leases.js <<'JS'
export function createLeases() {
  const held = new Set();
  return {
    async withLease(conversationId, fn) {
      if (held.has(conversationId)) throw new Error("conversation busy");
      held.add(conversationId);
      try {
        return await fn();
      } finally {
        held.delete(conversationId);
      }
    },
  };
}
JS
cat > src/turns/run-turn.js <<'JS'
export function createTurnRunner({ model, history }) {
  return async function runTurn(conversationId, text) {
    history.append(conversationId, { role: "user", text });
    const reply = await model.reply(history.read(conversationId));
    history.append(conversationId, { role: "assistant", text: reply });
    return { reply };
  };
}
JS
cat > src/socket/schema.js <<'JS'
function requireString(value, name) {
  if (typeof value !== "string" || value === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

export function parseMessage(data) {
  if (data === null || typeof data !== "object") {
    throw new TypeError("message must be an object");
  }
  return {
    conversationId: requireString(data.conversationId, "conversationId"),
    text: requireString(data.text, "text"),
  };
}
JS
cat > src/socket/handler.js <<'JS'
import { parseMessage } from "./schema.js";

export async function handleMessage(deps, raw) {
  const data = parseMessage(raw);
  return deps.leases.withLease(data.conversationId, () =>
    deps.runTurn(data.conversationId, data.text),
  );
}
JS
cat > client/chat-client.js <<'JS'
export function createChatClient({ transport, conversationId }) {
  return {
    send(text) {
      return transport.request("message", { conversationId, text });
    },
  };
}
JS
cat > test/helpers.js <<'JS'
export function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

export function memoryHistory() {
  const rows = new Map();
  return {
    append(id, entry) {
      rows.set(id, [...(rows.get(id) ?? []), entry]);
    },
    read(id) {
      return rows.get(id) ?? [];
    },
  };
}
JS
cat > test/leases.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLeases } from "../src/leases.js";
import { deferred } from "./helpers.js";

test("a second lease on the same conversation is rejected while one is held", async () => {
  const leases = createLeases();
  const gate = deferred();
  const first = leases.withLease("c1", () => gate.promise);
  await assert.rejects(leases.withLease("c1", async () => "x"), /busy/);
  gate.resolve("done");
  assert.equal(await first, "done");
});

test("the lease is released after the work fails", async () => {
  const leases = createLeases();
  await assert.rejects(leases.withLease("c1", async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await leases.withLease("c1", async () => "ok"), "ok");
});
JS
cat > test/handler.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLeases } from "../src/leases.js";
import { createTurnRunner } from "../src/turns/run-turn.js";
import { handleMessage } from "../src/socket/handler.js";
import { memoryHistory } from "./helpers.js";

function setup() {
  const history = memoryHistory();
  const model = { async reply(entries) { return `echo ${entries.at(-1).text}`; } };
  return { history, leases: createLeases(), runTurn: createTurnRunner({ model, history }) };
}

test("a message runs one turn and returns the reply", async () => {
  const deps = setup();
  const result = await handleMessage(deps, { conversationId: "c1", text: "hi" });
  assert.deepEqual(result, { reply: "echo hi" });
  assert.equal(deps.history.read("c1").length, 2);
});

test("a malformed message is rejected before any turn runs", async () => {
  const deps = setup();
  await assert.rejects(handleMessage(deps, { conversationId: "c1" }), /text must be/);
  assert.equal(deps.history.read("c1").length, 0);
});
JS
git add -A
git commit -q -m "feat: add the chat socket handler and conversation leases"
node --test >/dev/null

git switch -q -c feat/turn-resume

# commit 1: schema carries a turn id, resume message shape
cat > src/socket/schema.js <<'JS'
function requireString(value, name) {
  if (typeof value !== "string" || value === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireObject(data) {
  if (data === null || typeof data !== "object") {
    throw new TypeError("message must be an object");
  }
  return data;
}

export function parseMessage(data) {
  const input = requireObject(data);
  const message = {
    conversationId: requireString(input.conversationId, "conversationId"),
    text: requireString(input.text, "text"),
  };
  if (input.turnId !== undefined) message.turnId = requireString(input.turnId, "turnId");
  return message;
}

export function parseResume(data) {
  const input = requireObject(data);
  return {
    conversationId: requireString(input.conversationId, "conversationId"),
    turnId: requireString(input.turnId, "turnId"),
  };
}
JS
cat >> test/handler.test.js <<'JS'

test("a message may carry a turn id", async () => {
  const deps = setup();
  const result = await handleMessage(deps, { conversationId: "c1", text: "hi", turnId: "t1" });
  assert.deepEqual(result, { reply: "echo hi" });
});
JS
git add -A
git commit -q -m "feat(socket): accept a turn id and a resume message shape"

# commit 2: claim store
cat > src/turns/claims.js <<'JS'
export function createClaims() {
  const turns = new Map();
  return {
    claim(turnId) {
      const existing = turns.get(turnId);
      if (existing) return { ...existing };
      turns.set(turnId, { state: "running" });
      return { state: "claimed" };
    },
    complete(turnId, result) {
      turns.set(turnId, { state: "done", result });
    },
    release(turnId) {
      turns.delete(turnId);
    },
    get(turnId) {
      const turn = turns.get(turnId);
      return turn ? { ...turn } : null;
    },
  };
}
JS
cat > test/claims.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaims } from "../src/turns/claims.js";

test("the first claim wins and later claims see the turn running", () => {
  const claims = createClaims();
  assert.equal(claims.claim("t1").state, "claimed");
  assert.equal(claims.claim("t1").state, "running");
});

test("a completed turn keeps its result", () => {
  const claims = createClaims();
  claims.claim("t1");
  claims.complete("t1", { reply: "hi" });
  assert.deepEqual(claims.claim("t1"), { state: "done", result: { reply: "hi" } });
});

test("a released turn can be claimed again", () => {
  const claims = createClaims();
  claims.claim("t1");
  claims.release("t1");
  assert.equal(claims.claim("t1").state, "claimed");
});
JS
git add -A
git commit -q -m "feat(turns): add a claim store for turn ids"

# commit 3: handler uses withTurnClaim
cat > src/socket/turn-claim.js <<'JS'
export async function claimedTurn(deps, data, turn) {
  const claim = deps.claims.claim(data.turnId);
  if (claim.state === "done") return claim.result;
  if (claim.state === "running") throw new Error("turn already running");

  return deps.leases.withLease(data.conversationId, async () => {
    try {
      const result = await turn();
      deps.claims.complete(data.turnId, result);
      return result;
    } catch (error) {
      deps.claims.release(data.turnId);
      throw error;
    }
  });
}
JS
cat > src/socket/turn-runner.js <<'JS'
import { claimedTurn } from "./turn-claim.js";

export function withTurnClaim(deps, data, turn) {
  return data.turnId ? claimedTurn(deps, data, turn) : turn();
}
JS
cat > src/socket/handler.js <<'JS'
import { parseMessage } from "./schema.js";
import { withTurnClaim } from "./turn-runner.js";

export async function handleMessage(deps, raw) {
  const data = parseMessage(raw);
  return withTurnClaim(deps, data, () => deps.runTurn(data.conversationId, data.text));
}
JS
python3 - <<'PY'
p='test/handler.test.js'
s=open(p).read()
s=s.replace('import { memoryHistory } from "./helpers.js";','import { createClaims } from "../src/turns/claims.js";\nimport { deferred, memoryHistory } from "./helpers.js";')
s=s.replace('return { history, leases: createLeases(), runTurn','return { history, leases: createLeases(), claims: createClaims(), runTurn')
s+='''
test("a repeated turn id returns the first result without running another turn", async () => {
  const deps = setup();
  const message = { conversationId: "c1", text: "hi", turnId: "t1" };
  await handleMessage(deps, message);
  assert.deepEqual(await handleMessage(deps, message), { reply: "echo hi" });
  assert.equal(deps.history.read("c1").length, 2);
});

test("a turn that fails can be sent again with the same turn id", async () => {
  const deps = setup();
  let fail = true;
  const runTurn = deps.runTurn;
  deps.runTurn = async (id, text) => {
    if (fail) { fail = false; throw new Error("model down"); }
    return runTurn(id, text);
  };
  const message = { conversationId: "c1", text: "hi", turnId: "t1" };
  await assert.rejects(handleMessage(deps, message), /model down/);
  assert.deepEqual(await handleMessage(deps, message), { reply: "echo hi" });
});

test("a turn id that is still running is not started twice", async () => {
  const deps = setup();
  const gate = deferred();
  deps.runTurn = () => gate.promise;
  const message = { conversationId: "c1", text: "hi", turnId: "t1" };
  const first = handleMessage(deps, message);
  await assert.rejects(handleMessage(deps, message), /already running/);
  gate.resolve({ reply: "late" });
  assert.deepEqual(await first, { reply: "late" });
});

test("two turn ids on one conversation do not overlap", async () => {
  const deps = setup();
  const gate = deferred();
  deps.runTurn = () => gate.promise;
  const first = handleMessage(deps, { conversationId: "c1", text: "a", turnId: "t1" });
  await assert.rejects(handleMessage(deps, { conversationId: "c1", text: "b", turnId: "t2" }), /busy/);
  gate.resolve({ reply: "ok" });
  await first;
});
'''
open(p,'w').write(s)
PY
git add -A
git commit -q -m "refactor(socket): run turns through withTurnClaim"
node --test >/dev/null

# commit 4: resume handler
cat > src/socket/resume.js <<'JS'
import { parseResume } from "./schema.js";

export function handleResume(deps, raw) {
  const { turnId } = parseResume(raw);
  const turn = deps.claims.get(turnId);
  if (!turn) throw new Error("unknown turn");
  if (turn.state === "running") return { state: "running" };
  return { state: "done", result: turn.result };
}

export function retryLast(deps, raw) {
  const { conversationId } = parseResume(raw);
  return deps.leases.withLease(conversationId, async () => {
    const last = deps.history.read(conversationId).findLast((entry) => entry.role === "user");
    if (!last) throw new Error("nothing to retry");
    return deps.runTurn(conversationId, last.text);
  });
}
JS
cat > test/resume.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaims } from "../src/turns/claims.js";
import { handleResume } from "../src/socket/resume.js";

test("resuming a finished turn returns its result", () => {
  const claims = createClaims();
  claims.claim("t1");
  claims.complete("t1", { reply: "hi" });
  assert.deepEqual(handleResume({ claims }, { conversationId: "c1", turnId: "t1" }), {
    state: "done",
    result: { reply: "hi" },
  });
});

test("resuming a running turn reports it as running", () => {
  const claims = createClaims();
  claims.claim("t1");
  assert.deepEqual(handleResume({ claims }, { conversationId: "c1", turnId: "t1" }), { state: "running" });
});

test("resuming an unknown turn fails", () => {
  assert.throws(() => handleResume({ claims: createClaims() }, { conversationId: "c1", turnId: "nope" }), /unknown turn/);
});
JS
git add -A
git commit -q -m "feat(socket): add the resume handler"

# commit 5: client turn ids, retry, resume
cat > client/retry.js <<'JS'
export async function withRetry(fn, { attempts = 3, delayMs = 50 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error.code !== "ETIMEDOUT") throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
JS
cat > client/chat-client.js <<'JS'
import { randomUUID } from "node:crypto";
import { withRetry } from "./retry.js";

export function createChatClient({ transport, conversationId }) {
  return {
    send(text) {
      const turnId = randomUUID();
      const payload = { conversationId, text, turnId };
      return withRetry(() => transport.request("message", payload));
    },
    resume(turnId) {
      return transport.request("resume", { conversationId, turnId });
    },
  };
}
JS
cat > test/client.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatClient } from "../client/chat-client.js";

test("send generates a turn id and reuses it when a request times out", async () => {
  const seen = [];
  const transport = {
    async request(type, payload) {
      seen.push(payload);
      if (seen.length === 1) throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      return { reply: "ok" };
    },
  };
  const client = createChatClient({ transport, conversationId: "c1" });
  assert.deepEqual(await client.send("hi"), { reply: "ok" });
  assert.equal(seen.length, 2);
  assert.ok(seen[0].turnId);
  assert.equal(seen[0].turnId, seen[1].turnId);
});

test("resume asks the server for the given turn", async () => {
  const calls = [];
  const transport = { async request(type, payload) { calls.push([type, payload]); return { state: "running" }; } };
  const client = createChatClient({ transport, conversationId: "c1" });
  await client.resume("t9");
  assert.deepEqual(calls, [["resume", { conversationId: "c1", turnId: "t9" }]]);
});
JS
git add -A
git commit -q -m "feat(client): send a turn id, retry timeouts, and resume turns"

# commit 6: docs
cat > README.md <<'MD'
# chat-server

Socket handlers for a chat assistant.

- `src/socket/schema.js` validates incoming messages.
- `src/socket/handler.js` handles a message and runs one assistant turn.
- `src/socket/turn-runner.js` and `src/socket/turn-claim.js` record turn ids so a retried or resumed turn is not run twice.
- `src/socket/resume.js` answers a `resume` message with the state of a turn.
- `src/turns/claims.js` is the in-memory turn claim store.
- `src/leases.js` serialises work per conversation.
- `client/chat-client.js` is the bundled client; `client/retry.js` retries timeouts.

A conversation runs one turn at a time.

## Resuming a turn

A client that loses its connection sends `{ conversationId, turnId }` as a `resume`
message. The server answers `running`, or `done` with the stored result. Sending the
same `message` again with the same `turnId` returns the stored result instead of
running a second turn.

The chat client always sends a turnId.
MD
git add -A
git commit -q -m "docs: describe turn resume"
node --test >/dev/null
