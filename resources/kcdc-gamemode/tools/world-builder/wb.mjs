// A small client for World Builder's MCP endpoint (JSON-RPC over HTTP), for scripts in this folder.
//   node wb.mjs tools                      -> list tool names and descriptions
//   node wb.mjs schema <tool>              -> a tool's input schema
//   node wb.mjs call <tool> '<json args>'  -> call a tool (waits for a queued operation)
//   node wb.mjs state                      -> wb_get_state
import { randomUUID } from "node:crypto";

const URL = process.env.WB_URL ?? "http://127.0.0.1:7781/mcp";
const HEADERS = { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25", "Content-Type": "application/json" };

import http from "node:http";

function post(body) {
    return new Promise((resolve, reject) => {
        const url = new globalThis.URL(URL);
        const request = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: "POST", headers: { ...HEADERS, "Content-Length": Buffer.byteLength(body) } }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            const done = () => resolve(Buffer.concat(chunks).toString("utf8"));
            response.on("end", done);
            response.on("aborted", done);
            response.on("error", done);
        });
        request.on("error", reject);
        request.end(body);
    });
}

async function rpc(method, params = {}) {
    const text = await post(JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }));
    let reply;
    try {
        reply = JSON.parse(text);
    } catch {
        const line = text.split(/\r?\n/).find((one) => one.startsWith("data:"));
        reply = JSON.parse(line.slice(5));
    }
    if (reply.error) throw new Error(JSON.stringify(reply.error));
    return reply.result;
}

let initialized = false;
export async function connect() {
    if (initialized) return;
    await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "claude-wb", version: "1.0.0" } });
    await post(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
    initialized = true;
}

export async function tools() {
    await connect();
    let cursor;
    const all = [];
    do {
        const page = await rpc("tools/list", cursor ? { cursor } : {});
        all.push(...page.tools);
        cursor = page.nextCursor;
    } while (cursor);
    return all;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function call(name, args = {}) {
    await connect();
    const result = await rpc("tools/call", { name, arguments: args });
    if (result.isError) throw new Error(`${name}: ${JSON.stringify(result.structuredContent ?? result.content)}`);
    let receipt = result.structuredContent ?? result.content;
    const deadline = Date.now() + 60_000;
    while (receipt && receipt.operationId && receipt.status === "queued") {
        if (Date.now() > deadline) throw new Error(`still pending: ${receipt.operationId}`);
        await sleep(Math.max(50, receipt.pollAfterMs ?? 100));
        const polled = await rpc("tools/call", { name: "wb_operation_get", arguments: { operationId: receipt.operationId } });
        receipt = polled.structuredContent ?? polled.content;
    }
    if (receipt && receipt.operationId && receipt.status && receipt.status !== "completed") throw new Error(`${name}: ${JSON.stringify(receipt)}`);
    return receipt && receipt.operationId && "result" in receipt ? receipt.result : receipt;
}

/** An edit: the current revision and a fresh idempotency key are added. */
export async function edit(name, args = {}) {
    const state = await call("wb_get_state");
    return call(name, { expectedRevision: String(state.revision), idempotencyKey: randomUUID(), ...args });
}

if (process.argv[1] && process.argv[1].endsWith("wb.mjs")) {
    const [verb, a, b] = process.argv.slice(2);
    if (verb === "tools") {
        for (const tool of await tools()) console.log(`${tool.name}: ${(tool.description ?? "").replace(/\s+/g, " ").slice(0, 220)}`);
    } else if (verb === "schema") {
        const tool = (await tools()).find((one) => one.name === a);
        console.log(JSON.stringify(tool?.inputSchema ?? null, null, 1));
    } else if (verb === "call") {
        console.log(JSON.stringify(await call(a, b ? JSON.parse(b) : {}), null, 1));
    } else if (verb === "edit") {
        console.log(JSON.stringify(await edit(a, b ? JSON.parse(b) : {}), null, 1));
    } else {
        console.log(JSON.stringify(await call("wb_get_state"), null, 1));
    }
}
